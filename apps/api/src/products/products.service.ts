import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateProductDto, UpdateProductDto } from './products.dto';
import { BusinessException } from '../common/business.exception';
import { StockService } from '../stock/stock.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async create(dto: CreateProductDto) {
    await this.ensureUnique(dto.sku, dto.barcode);
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new BusinessException('Catégorie introuvable.', HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND');
    }
    const initial = dto.currentStock ?? 0;
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode || null,
          categoryId: dto.categoryId,
          unit: dto.unit ?? 'pièce',
          purchasePrice: dto.purchasePrice,
          salePrice: dto.salePrice,
          currentStock: 0,
          minimumStock: dto.minimumStock ?? 0,
          active: dto.active ?? true,
        },
        include: { category: true },
      });
      if (initial > 0) {
        await this.stock.applyMovement(tx, {
          productId: product.id,
          type: 'ADJUSTMENT',
          signedQuantity: initial,
          reason: 'Stock initial',
          reference: `INIT-${product.sku}`,
        });
      }
      return tx.product.findUnique({ where: { id: product.id }, include: { category: true } });
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    if (dto.sku && dto.sku !== existing.sku) await this.ensureUnique(dto.sku, undefined, id);
    if (dto.barcode !== undefined && dto.barcode !== existing.barcode) {
      await this.ensureUnique(undefined, dto.barcode ?? undefined, id);
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode === undefined ? undefined : dto.barcode || null,
        categoryId: dto.categoryId,
        unit: dto.unit,
        purchasePrice: dto.purchasePrice,
        salePrice: dto.salePrice,
        minimumStock: dto.minimumStock,
        active: dto.active,
      },
      include: { category: true },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!product) {
      throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    return product;
  }

  async search(q: string, take = 20) {
    const query = q.trim();
    if (!query) return [];
    return this.prisma.product.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
          { barcode: { equals: query } },
        ],
      },
      include: { category: true },
      take,
      orderBy: { name: 'asc' },
    });
  }

  async list(params: { q?: string; categoryId?: string; skip?: number; take?: number; active?: boolean }) {
    const where: Prisma.ProductWhereInput = {
      categoryId: params.categoryId,
      active: params.active,
    };
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
        skip: params.skip ?? 0,
        take: params.take ?? 50,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total };
  }

  private async ensureUnique(sku?: string, barcode?: string, excludeId?: string) {
    if (sku) {
      const found = await this.prisma.product.findUnique({ where: { sku } });
      if (found && found.id !== excludeId) {
        throw new BusinessException('Référence (SKU) déjà utilisée.', HttpStatus.CONFLICT, 'DUPLICATE_SKU');
      }
    }
    if (barcode) {
      const found = await this.prisma.product.findUnique({ where: { barcode } });
      if (found && found.id !== excludeId) {
        throw new BusinessException('Code-barres déjà utilisé.', HttpStatus.CONFLICT, 'DUPLICATE_BARCODE');
      }
    }
  }
}
