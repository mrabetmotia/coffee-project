import { HttpStatus, Injectable } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { paymentStatusFromAmounts } from '@cafestock/shared';
import { PrismaService } from '../prisma/prisma.module';
import { CreatePaymentDto } from './payments.dto';
import { BusinessException } from '../common/business.exception';
import { roundMoney, toNumber } from '../common/decimal';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(skip = 0, take = 50) {
    return this.prisma.$transaction([
      this.prisma.payment.findMany({
        include: { sale: { select: { invoiceNumber: true, client: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count(),
    ]).then(([items, total]) => ({ items, total }));
  }

  add(dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: dto.saleId } });
      if (!sale) {
        throw new BusinessException('Vente introuvable.', HttpStatus.NOT_FOUND, 'SALE_NOT_FOUND');
      }
      const remaining = toNumber(sale.remainingAmount);
      const amount = roundMoney(dto.amount);
      if (amount > remaining) {
        throw new BusinessException('Montant supérieur au reste à payer.', HttpStatus.BAD_REQUEST, 'INVALID_PAYMENT');
      }
      const paidAmount = roundMoney(toNumber(sale.paidAmount) + amount);
      const remainingAmount = roundMoney(toNumber(sale.total) - paidAmount);
      const paymentStatus = paymentStatusFromAmounts(toNumber(sale.total), paidAmount) as PaymentStatus;

      const payment = await tx.payment.create({
        data: {
          saleId: sale.id,
          amount,
          method: dto.method,
          notes: dto.notes,
        },
      });

      await tx.sale.update({
        where: { id: sale.id },
        data: { paidAmount, remainingAmount, paymentStatus },
      });

      if (dto.method === PaymentMethod.CASH) {
        await tx.cashTransaction.create({
          data: {
            type: sale.clientId ? 'CUSTOMER_PAYMENT' : 'SALE_PAYMENT',
            amount,
            method: dto.method,
            saleId: sale.id,
            paymentId: payment.id,
            notes: sale.invoiceNumber,
          },
        });
      }

      return tx.payment.findUnique({
        where: { id: payment.id },
        include: { sale: true },
      });
    });
  }
}
