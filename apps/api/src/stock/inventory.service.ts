import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { StockService } from './stock.service';
import { InventoryDto } from './inventory.dto';
import { BusinessException } from '../common/business.exception';
import { roundQty, toNumber } from '../common/decimal';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async adjust(dto: InventoryDto) {
    if (!dto.items.length) {
      throw new BusinessException('Aucune ligne d’inventaire.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
    }
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.inventorySession.create({ data: { notes: dto.notes } });
      for (const line of dto.items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) {
          throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        }
        const systemStock = toNumber(product.currentStock);
        const physicalStock = roundQty(line.physicalStock);
        const difference = roundQty(physicalStock - systemStock);
        await tx.inventorySessionItem.create({
          data: {
            sessionId: session.id,
            productId: product.id,
            systemStock,
            physicalStock,
            difference,
          },
        });
        if (difference === 0) continue;
        await this.stock.applyMovement(tx, {
          productId: product.id,
          type: 'ADJUSTMENT',
          signedQuantity: difference,
          reason: dto.notes ?? 'Inventaire',
          reference: `INV-${session.id}`,
        });
      }
      return tx.inventorySession.findUnique({
        where: { id: session.id },
        include: { items: { include: { product: true } } },
      });
    });
  }

  list() {
    return this.prisma.inventorySession.findMany({
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
