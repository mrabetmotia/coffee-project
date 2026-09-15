import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import { CreateClientDto, UpdateClientDto } from './clients.dto';
import { BusinessException } from '../common/business.exception';
import { toNumber } from '../common/decimal';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string) {
    const where: Prisma.ClientWhereInput = q?.trim()
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }] }
      : {};
    const clients = await this.prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        user: { select: { id: true, username: true, role: true, isActive: true, email: true, name: true } },
        sales: { select: { total: true, remainingAmount: true, paidAmount: true } },
        _count: { select: { orders: true } },
      },
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
        user: { select: { id: true, username: true, role: true, isActive: true, email: true, name: true } },
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

  async create(dto: CreateClientDto) {
    const username = dto.username.trim();
    const email = dto.email.trim();
    const name = dto.name.trim();
    if (!username || !name) {
      throw new BusinessException('Nom et identifiant requis.', HttpStatus.BAD_REQUEST, 'INVALID_CLIENT');
    }
    const [existingUser, existingClient] = await Promise.all([
      this.prisma.user.findFirst({ where: { OR: [{ username }, { email }] } }),
      this.prisma.client.findUnique({ where: { email } }),
    ]);
    if (existingUser || existingClient) {
      throw new BusinessException('Un compte avec cet identifiant ou email existe déjà.', HttpStatus.CONFLICT, 'DUPLICATE_CLIENT');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          name,
          email,
          role: UserRole.CLIENT,
          isActive: dto.isActive ?? true,
        },
      });
      const client = await tx.client.create({
        data: {
          userId: user.id,
          name,
          email,
          phone: dto.phone,
          address: dto.address,
          notes: dto.notes,
          isActive: dto.isActive ?? true,
        },
        include: { user: { select: { id: true, username: true, role: true, isActive: true, email: true, name: true } } },
      });
      return client;
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    const email = dto.email?.trim() || undefined;
    const name = dto.name?.trim();
    const data: Prisma.ClientUpdateInput = {
      name,
      email,
      phone: dto.phone,
      address: dto.address,
      notes: dto.notes,
      isActive: dto.isActive,
    };
    if (dto.password) {
      const client = await this.prisma.client.findUnique({ where: { id }, include: { user: true } });
      if (!client?.user) {
        throw new BusinessException('Compte client introuvable.', HttpStatus.NOT_FOUND, 'CLIENT_NO_USER');
      }
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await this.prisma.user.update({ where: { id: client.user.id }, data: { passwordHash } });
    }
    return this.prisma.client.update({ where: { id }, data });
  }

  async setStatus(id: string, isActive: boolean, actorId: string) {
    const client = await this.prisma.client.findUnique({ where: { id }, include: { user: true } });
    if (!client) {
      throw new BusinessException('Client introuvable.', HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND');
    }
    if (client.userId && client.userId !== actorId && client.user?.role === UserRole.CLIENT) {
      // no-op: admin is allowed to set status; this guard is not used for an admin endpoint.
    }
    await this.prisma.client.update({ where: { id }, data: { isActive } });
    if (client.userId) {
      await this.prisma.user.update({ where: { id: client.userId }, data: { isActive } });
    }
    return { id, isActive };
  }
}
