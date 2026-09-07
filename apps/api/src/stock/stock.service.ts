import { HttpStatus, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DbClient } from '../common/document-number';
import { BusinessException } from '../common/business.exception';
import { roundQty, toNumber } from '../common/decimal';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async applyMovement(
    db: DbClient,
    params: {
      productId: string;
      type: StockMovementType;
      signedQuantity: number;
      reason?: string;
      reference?: string;
    },
  ) {
    const product = await db.product.findUnique({ where: { id: params.productId } });
    if (!product) {
      throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    const stockBefore = toNumber(product.currentStock);
    const stockAfter = roundQty(stockBefore + params.signedQuantity);
    if (stockAfter < 0) {
      throw new BusinessException(
        `Stock insuffisant pour « ${product.name} » (disponible : ${stockBefore}).`,
        HttpStatus.BAD_REQUEST,
        'INSUFFICIENT_STOCK',
      );
    }
    await db.product.update({
      where: { id: product.id },
      data: { currentStock: stockAfter },
    });
    await db.stockMovement.create({
      data: {
        productId: product.id,
        type: params.type,
        quantity: Math.abs(params.signedQuantity),
        stockBefore,
        stockAfter,
        reason: params.reason,
        reference: params.reference,
      },
    });
    return { stockBefore, stockAfter, product };
  }

  async list(params: { productId?: string; type?: StockMovementType; skip?: number; take?: number }) {
    const where = {
      productId: params.productId,
      type: params.type,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, total };
  }

  async lowStock() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return products.filter((p) => toNumber(p.currentStock) <= toNumber(p.minimumStock));
  }
}
