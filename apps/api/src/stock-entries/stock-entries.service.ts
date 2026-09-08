import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { CreateStockEntryDto } from './stock-entries.dto';
import { StockService } from '../stock/stock.service';
import { BusinessException } from '../common/business.exception';
import { nextDocumentNumber } from '../common/document-number';
import { roundMoney, roundQty, toNumber } from '../common/decimal';

/**
 * Weighted average cost (CMP):
 * newCost = (oldQty * oldCost + qty * unitPrice) / (oldQty + qty)
 */
export function computeWeightedAverageCost(
  oldQty: number,
  oldCost: number,
  addQty: number,
  addCost: number,
): number {
  const nextQty = oldQty + addQty;
  if (nextQty <= 0) return oldCost;
  return roundMoney((oldQty * oldCost + addQty * addCost) / nextQty);
}

@Injectable()
export class StockEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  list(skip = 0, take = 50) {
    return this.prisma.$transaction([
      this.prisma.stockEntry.findMany({
        include: { items: { include: { product: { select: { name: true, sku: true, image: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.stockEntry.count(),
    ]).then(([items, total]) => ({ items, total }));
  }

  async findOne(id: string) {
    const entry = await this.prisma.stockEntry.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!entry) {
      throw new BusinessException('Entrée de stock introuvable.', HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return entry;
  }

  create(dto: CreateStockEntryDto) {
    if (!dto.items.length) {
      throw new BusinessException('Ajoutez au moins un produit.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
    }
    return this.prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, 'ENT');
      let totalCost = 0;
      const entry = await tx.stockEntry.create({
        data: { number, notes: dto.notes, totalCost: 0 },
      });
      for (const line of dto.items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) {
          throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        const qty = roundQty(line.quantity);
        const unitPrice = roundMoney(line.unitPurchasePrice);
        const lineCost = roundMoney(qty * unitPrice);
        totalCost += lineCost;
        const newCost = computeWeightedAverageCost(
          toNumber(product.currentStock),
          toNumber(product.purchasePrice),
          qty,
          unitPrice,
        );
        await tx.stockEntryItem.create({
          data: {
            stockEntryId: entry.id,
            productId: product.id,
            quantity: qty,
            unitPurchasePrice: unitPrice,
            lineCost,
          },
        });
        await this.stock.applyMovement(tx, {
          productId: product.id,
          type: 'ENTRY',
          signedQuantity: qty,
          reason: 'Entrée stock',
          reference: number,
        });
        await tx.product.update({
          where: { id: product.id },
          data: { purchasePrice: newCost },
        });
      }
      return tx.stockEntry.update({
        where: { id: entry.id },
        data: { totalCost: roundMoney(totalCost) },
        include: { items: { include: { product: true } } },
      });
    });
  }
}
