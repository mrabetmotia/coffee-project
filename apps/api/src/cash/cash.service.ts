import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { toNumber } from '../common/decimal';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const settings = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    const opening = toNumber(settings?.openingBalance);
    const txs = await this.prisma.cashTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const all = await this.prisma.cashTransaction.findMany();
    const salesCash = all
      .filter((t) => t.type === 'SALE_PAYMENT' || t.type === 'CUSTOMER_PAYMENT')
      .reduce((s, t) => s + toNumber(t.amount), 0);
    const refunds = all.filter((t) => t.type === 'REFUND').reduce((s, t) => s + toNumber(t.amount), 0);
    const currentBalance = opening + salesCash + refunds;
    return {
      openingBalance: opening,
      salesCashPayments: salesCash,
      refunds,
      currentBalance,
      transactions: txs,
    };
  }
}
