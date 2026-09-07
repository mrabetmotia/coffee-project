import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { CreateClientDto, UpdateClientDto } from './clients.dto';
import { BusinessException } from '../common/business.exception';
import { toNumber } from '../common/decimal';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string) {
    const where: Prisma.ClientWhereInput = q?.trim()
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : {};
    const clients = await this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { sales: { select: { total: true, remainingAmount: true, paidAmount: true } } },
    });
    return clients.map((c) => {
      const salesCount = c.sales.length;
      const totalPurchases = c.sales.reduce((s, x) => s + toNumber(x.total), 0);
      const remainingBalance = c.sales.reduce((s, x) => s + toNumber(x.remainingAmount), 0);
      const paid = c.sales.reduce((s, x) => s + toNumber(x.paidAmount), 0);
      const { sales: _s, ...rest } = c;
      return { ...rest, salesCount, totalPurchases, remainingBalance, paid };
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        sales: { orderBy: { createdAt: 'desc' }, include: { payments: true } },
      },
    });
    if (!client) {
      throw new BusinessException('Client introuvable.', HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND');
    }
    const salesCount = client.sales.length;
    const totalPurchases = client.sales.reduce((s, x) => s + toNumber(x.total), 0);
    const remainingBalance = client.sales.reduce((s, x) => s + toNumber(x.remainingAmount), 0);
    const paid = client.sales.reduce((s, x) => s + toNumber(x.paidAmount), 0);
    return { ...client, salesCount, totalPurchases, remainingBalance, paid };
  }

  create(dto: CreateClientDto) {
    return this.prisma.client.create({ data: dto });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }
}
