import { HttpStatus, Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { DbClient } from '../common/document-number';
import { BusinessException } from '../common/business.exception';
import { roundQty, toNumber } from '../common/decimal';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileLowStockNotifications(db: DbClient, productId: string) {
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const users = await db.user.findMany({ select: { id: true } });
    if (!users.length) return;

    const userIds = users.map((user) => user.id);
    const currentStock = toNumber(product.currentStock);
    const minimumStock = toNumber(product.minimumStock);
    const isLowStock = currentStock <= minimumStock;
    const lowStockPredicate = {
      type: 'low_stock',
      userId: { in: userIds },
      metadata: {
        path: ['productId'],
        equals: product.id,
      },
    } as const;

    if (isLowStock) {
      const exists = await db.notification.findFirst({ where: lowStockPredicate });
      if (exists) return;

      await Promise.all(
        users.map((user) =>
          db.notification.create({
            data: {
              id: `low-stock-${user.id}-${product.id}`,
              userId: user.id,
              type: 'low_stock',
              title: 'Stock faible',
              message: `${product.name} — Stock actuel: ${currentStock} / Stock minimum: ${minimumStock}`,
              actionLabel: 'Voir le stock',
              actionUrl: `/stock/produits/${product.id}`,
              persistent: true,
              metadata: {
                productId: product.id,
                productName: product.name,
                currentStock,
                minimumStock,
              },
            },
          }),
        ),
      );
      return;
    }

    await db.notification.deleteMany({ where: lowStockPredicate });
  }

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
    await this.reconcileLowStockNotifications(db, product.id);
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
        include: { product: { select: { name: true, sku: true, image: true } } },
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
