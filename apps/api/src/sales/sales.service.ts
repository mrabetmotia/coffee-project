import { HttpStatus, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma, SaleStatus } from '@prisma/client';
import { paymentStatusFromAmounts } from '@cafestock/shared';
import { PrismaService } from '../prisma/prisma.module';
import { CreateReturnDto, CreateSaleDto } from './sales.dto';
import { StockService } from '../stock/stock.service';
import { BusinessException } from '../common/business.exception';
import { nextDocumentNumber } from '../common/document-number';
import { roundMoney, roundQty, toNumber } from '../common/decimal';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  create(dto: CreateSaleDto) {
    if (!dto.items.length) {
      throw new BusinessException('Le panier est vide.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.clientId) {
        const client = await tx.client.findUnique({ where: { id: dto.clientId } });
        if (!client) {
          throw new BusinessException('Client introuvable.', HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND');
        }
      }

      const merged = new Map<string, { productId: string; quantity: number; unitPrice?: number }>();
      for (const line of dto.items) {
        const prev = merged.get(line.productId);
        const qty = roundQty(line.quantity);
        if (prev) prev.quantity = roundQty(prev.quantity + qty);
        else merged.set(line.productId, { productId: line.productId, quantity: qty, unitPrice: line.unitPrice });
      }

      let subtotal = 0;
      let costAmount = 0;
      const prepared: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        lineTotal: number;
        lineCost: number;
        lineProfit: number;
      }> = [];

      for (const line of merged.values()) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) {
          throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        if (toNumber(product.currentStock) < line.quantity) {
          throw new BusinessException(
            `Stock insuffisant pour « ${product.name} ».`,
            HttpStatus.BAD_REQUEST,
            'INSUFFICIENT_STOCK',
          );
        }
        const unitPrice = roundMoney(line.unitPrice ?? toNumber(product.salePrice));
        const unitCost = roundMoney(toNumber(product.purchasePrice));
        const lineTotal = roundMoney(unitPrice * line.quantity);
        const lineCost = roundMoney(unitCost * line.quantity);
        subtotal = roundMoney(subtotal + lineTotal);
        costAmount = roundMoney(costAmount + lineCost);
        prepared.push({
          productId: product.id,
          quantity: line.quantity,
          unitPrice,
          unitCost,
          lineTotal,
          lineCost,
          lineProfit: roundMoney(lineTotal - lineCost),
        });
      }

      const discountAmount = roundMoney(dto.discountAmount ?? 0);
      if (discountAmount > subtotal) {
        throw new BusinessException('Remise supérieure au sous-total.', HttpStatus.BAD_REQUEST, 'INVALID_PAYMENT');
      }
      const total = roundMoney(subtotal - discountAmount);
      const paidAmount = roundMoney(Math.min(dto.paidAmount ?? 0, total));
      const remainingAmount = roundMoney(total - paidAmount);
      const profitAmount = roundMoney(total - costAmount);
      const paymentStatus = paymentStatusFromAmounts(total, paidAmount) as PaymentStatus;
      const invoiceNumber = await nextDocumentNumber(tx, 'FAC');

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          clientId: dto.clientId || null,
          status: 'FINALIZED',
          paymentStatus,
          subtotal,
          discountAmount,
          total,
          paidAmount,
          remainingAmount,
          costAmount,
          profitAmount,
          notes: dto.notes,
        },
      });

      for (const line of prepared) {
        await tx.saleItem.create({ data: { saleId: sale.id, ...line } });
        await this.stock.applyMovement(tx, {
          productId: line.productId,
          type: 'SALE',
          signedQuantity: -line.quantity,
          reason: 'Vente',
          reference: invoiceNumber,
        });
      }

      if (paidAmount > 0) {
        const method = dto.paymentMethod ?? PaymentMethod.CASH;
        const payment = await tx.payment.create({
          data: { saleId: sale.id, amount: paidAmount, method },
        });
        if (method === PaymentMethod.CASH) {
          await tx.cashTransaction.create({
            data: {
              type: 'SALE_PAYMENT',
              amount: paidAmount,
              method,
              saleId: sale.id,
              paymentId: payment.id,
              notes: invoiceNumber,
            },
          });
        }
      }

      await tx.invoice.create({ data: { saleId: sale.id, number: invoiceNumber } });

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: { include: { product: true } },
          client: true,
          payments: true,
          invoice: true,
        },
      });
    });
  }

  async list(params: {
    q?: string;
    clientId?: string;
    paymentStatus?: PaymentStatus;
    from?: string;
    to?: string;
    minAmount?: number;
    maxAmount?: number;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.SaleWhereInput = {
      clientId: params.clientId,
      paymentStatus: params.paymentStatus,
    };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }
    if (params.minAmount !== undefined || params.maxAmount !== undefined) {
      where.total = {};
      if (params.minAmount !== undefined) where.total.gte = params.minAmount;
      if (params.maxAmount !== undefined) where.total.lte = params.maxAmount;
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [{ invoiceNumber: { contains: q } }, { client: { name: { contains: q } } }];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: { client: true, items: true },
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: true,
        invoice: true,
        returns: { include: { items: true } },
      },
    });
    if (!sale) {
      throw new BusinessException('Vente introuvable.', HttpStatus.NOT_FOUND, 'SALE_NOT_FOUND');
    }
    return sale;
  }

  createReturn(saleId: string, dto: CreateReturnDto) {
    if (!dto.items.length) {
      throw new BusinessException('Aucune ligne à retourner.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
    }
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, payments: true },
      });
      if (!sale) {
        throw new BusinessException('Vente introuvable.', HttpStatus.NOT_FOUND, 'SALE_NOT_FOUND');
      }

      let returnRevenue = 0;
      let returnCost = 0;
      const ret = await tx.saleReturn.create({
        data: { saleId, reason: dto.reason, refundAmount: 0 },
      });

      for (const line of dto.items) {
        const item = sale.items.find((i) => i.id === line.saleItemId);
        if (!item) {
          throw new BusinessException('Ligne de vente introuvable.', HttpStatus.NOT_FOUND, 'SALE_NOT_FOUND');
        }
        const already = toNumber(item.returnedQuantity);
        const remainingQty = roundQty(toNumber(item.quantity) - already);
        const qty = roundQty(line.quantity);
        if (qty > remainingQty) {
          throw new BusinessException('Quantité de retour supérieure à la quantité vendue.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
        }
        const ratio = qty / toNumber(item.quantity);
        const lineTotal = roundMoney(toNumber(item.lineTotal) * ratio);
        const lineCost = roundMoney(toNumber(item.lineCost) * ratio);
        const lineProfit = roundMoney(toNumber(item.lineProfit) * ratio);
        returnRevenue = roundMoney(returnRevenue + lineTotal);
        returnCost = roundMoney(returnCost + lineCost);

        await tx.saleReturnItem.create({
          data: {
            returnId: ret.id,
            saleItemId: item.id,
            productId: item.productId,
            quantity: qty,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            lineTotal,
            lineProfit,
          },
        });
        await tx.saleItem.update({
          where: { id: item.id },
          data: { returnedQuantity: roundQty(already + qty) },
        });
        await this.stock.applyMovement(tx, {
          productId: item.productId,
          type: 'CUSTOMER_RETURN',
          signedQuantity: qty,
          reason: dto.reason ?? 'Retour client',
          reference: sale.invoiceNumber,
        });
      }

      const newSubtotal = roundMoney(toNumber(sale.subtotal) - returnRevenue);
      const discountRatio = toNumber(sale.subtotal) === 0 ? 0 : toNumber(sale.discountAmount) / toNumber(sale.subtotal);
      const newDiscount = roundMoney(toNumber(sale.discountAmount) - returnRevenue * discountRatio);
      const newTotal = roundMoney(Math.max(0, newSubtotal - newDiscount));
      const newCost = roundMoney(toNumber(sale.costAmount) - returnCost);
      const newProfit = roundMoney(newTotal - newCost);

      const paidSoFar = toNumber(sale.paidAmount);
      let refundAmount = roundMoney(dto.refundAmount ?? 0);
      if (paidSoFar > newTotal) {
        const autoRefund = roundMoney(paidSoFar - newTotal);
        if (refundAmount === 0) refundAmount = autoRefund;
        refundAmount = Math.min(refundAmount, autoRefund);
      } else {
        refundAmount = Math.min(refundAmount, paidSoFar);
      }

      const newPaid = roundMoney(paidSoFar - refundAmount);
      const remainingAmount = roundMoney(newTotal - newPaid);
      const paymentStatus = paymentStatusFromAmounts(newTotal, newPaid) as PaymentStatus;

      const allItems = await tx.saleItem.findMany({ where: { saleId } });
      const fullyReturned = allItems.every(
        (i) => toNumber(i.returnedQuantity) >= toNumber(i.quantity),
      );
      const anyReturned = allItems.some((i) => toNumber(i.returnedQuantity) > 0);
      const status: SaleStatus = fullyReturned
        ? 'RETURNED'
        : anyReturned
          ? 'PARTIALLY_RETURNED'
          : 'FINALIZED';

      if (refundAmount > 0) {
        const method = dto.refundMethod ?? PaymentMethod.CASH;
        const payment = await tx.payment.create({
          data: {
            saleId,
            amount: -refundAmount,
            method,
            notes: 'Remboursement retour',
          },
        });
        if (method === PaymentMethod.CASH) {
          await tx.cashTransaction.create({
            data: {
              type: 'REFUND',
              amount: -refundAmount,
              method,
              saleId,
              paymentId: payment.id,
              notes: sale.invoiceNumber,
            },
          });
        }
      }

      await tx.saleReturn.update({ where: { id: ret.id }, data: { refundAmount } });
      await tx.sale.update({
        where: { id: saleId },
        data: {
          subtotal: newSubtotal,
          discountAmount: newDiscount,
          total: newTotal,
          costAmount: newCost,
          profitAmount: newProfit,
          paidAmount: newPaid,
          remainingAmount,
          paymentStatus,
          status,
        },
      });

      return tx.saleReturn.findUnique({
        where: { id: ret.id },
        include: { items: { include: { product: true } }, sale: true },
      });
    });
  }

  listReturns() {
    return this.prisma.saleReturn.findMany({
      include: {
        sale: { select: { invoiceNumber: true, createdAt: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
