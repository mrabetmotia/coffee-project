import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { BusinessException } from '../common/business.exception';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name, active: dto.active ?? true } });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensure(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensure(id);
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new BusinessException(
        'Impossible de supprimer une catégorie utilisée par des produits. Désactivez-la plutôt.',
        HttpStatus.CONFLICT,
        'CATEGORY_IN_USE',
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const found = await this.prisma.category.findUnique({ where: { id } });
    if (!found) {
      throw new BusinessException('Catégorie introuvable.', HttpStatus.NOT_FOUND, 'CATEGORY_NOT_FOUND');
    }
  }
}
