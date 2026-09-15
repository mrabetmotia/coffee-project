import { HttpStatus, Injectable } from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { BusinessException } from '../common/business.exception';
import { PrismaService } from '../prisma/prisma.module';
import { roundMoney, toNumber } from '../common/decimal';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForClient(userId: string, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { client: true } });
    if (!user || user.role !== UserRole.CLIENT || !user.isActive) {
      throw new BusinessException('Compte client introuvable ou inactif.', HttpStatus.FORBIDDEN, 'CLIENT_FORBIDDEN');
    }
    if (!user.client) {
      throw new BusinessException('Profil client introuvable.', HttpStatus.NOT_FOUND, 'CLIENT_PROFILE_NOT_FOUND');
    }
    const clientId = user.client.id;
    if (!dto.items?.length) {
      throw new BusinessException('Le panier est vide.', HttpStatus.BAD_REQUEST, 'EMPTY_CART');
    }

    return this.prisma.$transaction(async (tx) => {
      const merged = new Map<string, { productId: string; quantity: number }>();
      for (const line of dto.items) {
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new BusinessException('Quantité invalide.', HttpStatus.BAD_REQUEST, 'INVALID_QUANTITY');
        }
        const existing = merged.get(line.productId);
        if (existing) existing.quantity += qty;
        else merged.set(line.productId, { productId: line.productId, quantity: qty });
      }

      let totalAmount = 0;
      const orderItems: Array<{ productId: string; quantity: number; unitPrice: number; totalPrice: number }> = [];

      for (const line of merged.values()) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) throw new BusinessException('Produit introuvable.', HttpStatus.NOT_FOUND, 'PRODUCT_NOT_FOUND');
        if (!product.active) throw new BusinessException(`Produit inactif : ${product.name}`, HttpStatus.BAD_REQUEST, 'PRODUCT_INACTIVE');
        if (toNumber(product.currentStock) < line.quantity) {
          throw new BusinessException(`Stock insuffisant pour ${product.name}.`, HttpStatus.BAD_REQUEST, 'INSUFFICIENT_STOCK');
        }
        const unitPrice = roundMoney(toNumber(product.salePrice));
        const totalPrice = roundMoney(unitPrice * line.quantity);
        totalAmount = roundMoney(totalAmount + totalPrice);
        orderItems.push({ productId: product.id, quantity: line.quantity, unitPrice, totalPrice });
      }

      const order = await tx.customerOrder.create({
        data: {
          clientId,
          userId: user.id,
          totalAmount,
          note: dto.note?.trim() || null,
          status: 'PENDING',
          items: { create: orderItems },
        },
        include: { items: true, client: true },
      });

      await this.notifications.createForUser(user.id, {
        type: 'ORDER_CREATED',
        title: 'Commande créée',
        message: `Votre commande #${order.id.slice(0, 8)} a été envoyée et attend validation.`,
        actionLabel: 'Voir ma commande',
        actionUrl: `/client/orders/${order.id}`,
        metadata: { orderId: order.id, status: order.status },
      });

      await this.notifications.createForAdmins({
        type: 'NEW_CLIENT_ORDER',
        title: 'Action requise : nouvelle commande',
        message: `Une nouvelle commande client #${order.id.slice(0, 8)} attend votre validation.`,
        actionLabel: 'Voir la commande',
        actionUrl: `/admin/orders/${order.id}`,
        metadata: { orderId: order.id },
      });

      return order;
    });
  }

  async listForClient(userId: string, status?: string) {
    const where: Prisma.CustomerOrderWhereInput = { userId, ...(status ? { status: status as OrderStatus } : {}) };
    return this.prisma.customerOrder.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForAdmin(params: { status?: string; clientId?: string }) {
    const where: Prisma.CustomerOrderWhereInput = {
      ...(params.status ? { status: params.status as OrderStatus } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
    };
    return this.prisma.customerOrder.findMany({
      where,
      include: { client: true, user: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findClientOrder(userId: string, id: string) {
    const order = await this.prisma.customerOrder.findFirst({
      where: { id, userId },
      include: { items: { include: { product: true } }, client: true },
    });
    if (!order) throw new BusinessException('Commande introuvable.', HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    return order;
  }

  async findAdminOrder(id: string) {
    const order = await this.prisma.customerOrder.findUnique({
      where: { id },
      include: { client: true, user: true, items: { include: { product: true } } },
    });
    if (!order) throw new BusinessException('Commande introuvable.', HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    return order;
  }

  async cancelClientOrder(userId: string, id: string) {
    const order = await this.prisma.customerOrder.findFirst({ where: { id, userId } });
    if (!order) throw new BusinessException('Commande introuvable.', HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    if (order.status !== OrderStatus.PENDING) {
      throw new BusinessException('Seules les commandes en attente peuvent être annulées.', HttpStatus.BAD_REQUEST, 'INVALID_ORDER_STATE');
    }
    return this.updateStatusInternal(order.id, { status: OrderStatus.CANCELLED }, true);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.customerOrder.findUnique({ where: { id } });
    if (!order) throw new BusinessException('Commande introuvable.', HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');
    return this.updateStatusInternal(id, dto, false);
  }

  private async updateStatusInternal(id: string, dto: UpdateOrderStatusDto, clientCancelled = false) {
    const order = await this.prisma.customerOrder.findUnique({ where: { id } });
    if (!order) throw new BusinessException('Commande introuvable.', HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND');

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED],
      [OrderStatus.REJECTED]: [],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const transitions = validTransitions[order.status] ?? [];
    if (dto.status !== order.status && !transitions.includes(dto.status)) {
      throw new BusinessException('Transition de statut invalide.', HttpStatus.BAD_REQUEST, 'INVALID_ORDER_STATE');
    }

    if (dto.status === OrderStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BusinessException('Une raison est requise pour un refus.', HttpStatus.BAD_REQUEST, 'REJECTION_REASON_REQUIRED');
    }

    const updated = await this.prisma.customerOrder.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.status === OrderStatus.REJECTED ? dto.rejectionReason?.trim() ?? null : null,
      },
      include: { client: true, user: true },
    });

    const message = dto.status === OrderStatus.ACCEPTED
      ? 'Votre commande a été acceptée.'
      : dto.status === OrderStatus.REJECTED
        ? `Votre commande a été refusée. Raison: ${dto.rejectionReason?.trim() ?? ''}`
        : `Le statut de votre commande est maintenant ${dto.status}.`;

    await this.notifications.createForUser(updated.userId, {
      type: 'ORDER_STATUS_UPDATED',
      title: dto.status === OrderStatus.ACCEPTED ? 'Commande acceptée' : dto.status === OrderStatus.REJECTED ? 'Commande refusée' : 'Mise à jour de commande',
      message,
      actionLabel: 'Voir ma commande',
      actionUrl: `/client/orders/${updated.id}`,
      metadata: { orderId: updated.id, status: updated.status },
    });

    if (clientCancelled) {
      await this.notifications.createForAdmins({
        type: 'CLIENT_ORDER_CANCELLED',
        title: 'Commande client annulée',
        message: `La commande client #${updated.id.slice(0, 8)} a été annulée.`,
        actionLabel: 'Voir la commande',
        actionUrl: `/admin/orders/${updated.id}`,
        metadata: { orderId: updated.id, status: updated.status },
      });
    }

    return updated;
  }
}
