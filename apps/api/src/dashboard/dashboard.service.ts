import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { toNumber } from '../common/decimal';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  period(kind?: string, from?: string, to?: string): { gte?: Date; lte?: Date } {
    const now = new Date();
    if (from || to) {
      return { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
    }
    switch (kind) {
      case 'week': {
        const d = startOfDay(now);
        d.setDate(d.getDate() - d.getDay() + 1);
        return { gte: d };
      }
      case 'month':
        return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      case 'year':
        return { gte: new Date(now.getFullYear(), 0, 1) };
      case 'today':
      default:
        return { gte: startOfDay(now) };
    }
  }

  async overview(kind?: string, from?: string, to?: string) {
    const createdAt = this.period(kind, from, to) as Prisma.DateTimeFilter;
    const sales = await this.prisma.sale.findMany({
      where: { createdAt },
      include: { items: true, client: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    const revenue = sales.reduce((s, x) => s + toNumber(x.total), 0);
    const profit = sales.reduce((s, x) => s + toNumber(x.profitAmount), 0);
    const collected = sales.reduce((s, x) => s + toNumber(x.paidAmount), 0);
    const productsSold = sales.reduce(
      (s, x) => s + x.items.reduce((a, i) => a + toNumber(i.quantity) - toNumber(i.returnedQuantity), 0),
      0,
    );
    const remaining = await this.prisma.sale.aggregate({ _sum: { remainingAmount: true } });
    const productAgg = new Map<string, { name: string; qty: number }>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const prev = productAgg.get(item.productId) ?? { name: '', qty: 0 };
        prev.qty += toNumber(item.quantity) - toNumber(item.returnedQuantity);
        productAgg.set(item.productId, prev);
      }
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: [...productAgg.keys()] } },
    });
    for (const p of products) {
      const row = productAgg.get(p.id);
      if (row) row.name = p.name;
    }
    const bestSellers = [...productAgg.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

    const lowStock = (
      await this.prisma.product.findMany({ where: { active: true }, include: { category: true } })
    ).filter((p) => toNumber(p.currentStock) <= toNumber(p.minimumStock));

    const recentEntries = await this.prisma.stockEntry.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    const recentPayments = await this.prisma.payment.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { sale: { select: { invoiceNumber: true } } },
    });

    const chartSales = await this.prisma.sale.findMany({
      where: { createdAt },
      select: { createdAt: true, total: true, profitAmount: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<string, { date: string; sales: number; profit: number }>();
    for (const s of chartSales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      const prev = byDay.get(key) ?? { date: key, sales: 0, profit: 0 };
      prev.sales += toNumber(s.total);
      prev.profit += toNumber(s.profitAmount);
      byDay.set(key, prev);
    }

    return {
      revenue,
      profit,
      salesCount: sales.length,
      productsSold,
      collected,
      remainingBalances: toNumber(remaining._sum.remainingAmount),
      chart: [...byDay.values()],
      bestSellers,
      lowStock: lowStock.slice(0, 8),
      recentSales: sales.slice(0, 8),
      recentEntries,
      recentPayments,
    };
  }
}
