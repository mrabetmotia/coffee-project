import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.module';
import { toNumber } from '../common/decimal';
import { formatMoney } from '@cafestock/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    return {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    };
  }

  async sales(from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const sales = await this.prisma.sale.findMany({ where: { createdAt } });
    const revenue = sales.reduce((s, x) => s + toNumber(x.total), 0);
    const profit = sales.reduce((s, x) => s + toNumber(x.profitAmount), 0);
    const paid = sales.reduce((s, x) => s + toNumber(x.paidAmount), 0);
    const remaining = sales.reduce((s, x) => s + toNumber(x.remainingAmount), 0);
    return {
      count: sales.length,
      revenue,
      profit,
      paid,
      remaining,
    };
  }

  async products(from?: string, to?: string) {
    const createdAt = this.range(from, to);
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { createdAt } },
      include: { product: true },
    });
    const map = new Map<
      string,
      { productId: string; name: string; sku: string; quantity: number; revenue: number; profit: number }
    >();
    for (const item of items) {
      const qty = toNumber(item.quantity) - toNumber(item.returnedQuantity);
      const prev = map.get(item.productId) ?? {
        productId: item.productId,
        name: item.product.name,
        sku: item.product.sku,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
      prev.quantity += qty;
      const ratio = toNumber(item.quantity) === 0 ? 0 : qty / toNumber(item.quantity);
      prev.revenue += toNumber(item.lineTotal) * ratio;
      prev.profit += toNumber(item.lineProfit) * ratio;
      map.set(item.productId, prev);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }

  async customers() {
    const clients = await this.prisma.client.findMany({
      include: { sales: true },
      orderBy: { name: 'asc' },
    });
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      salesCount: c.sales.length,
      totalSpent: c.sales.reduce((s, x) => s + toNumber(x.total), 0),
      remainingBalance: c.sales.reduce((s, x) => s + toNumber(x.remainingAmount), 0),
    }));
  }

  async stock() {
    const products = await this.prisma.product.findMany({ include: { category: true }, orderBy: { name: 'asc' } });
    const movements = await this.prisma.stockMovement.findMany({
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const stockValue = products.reduce(
      (s, p) => s + toNumber(p.currentStock) * toNumber(p.purchasePrice),
      0,
    );
    const lowStock = products.filter((p) => toNumber(p.currentStock) <= toNumber(p.minimumStock) && p.active);
    return { products, stockValue, lowStock, movements };
  }

  async exportExcel(kind: 'sales' | 'products' | 'customers' | 'stock', from?: string, to?: string) {
    const dir = process.env.REPORT_DIR ?? join(process.cwd(), 'storage', 'reports');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(kind);
    if (kind === 'sales') {
      const data = await this.sales(from, to);
      sheet.addRow(['Ventes', 'CA', 'Profit', 'Payé', 'Reste']);
      sheet.addRow([data.count, data.revenue, data.profit, data.paid, data.remaining]);
    } else if (kind === 'products') {
      sheet.addRow(['Produit', 'SKU', 'Qté', 'CA', 'Profit']);
      for (const row of await this.products(from, to)) {
        sheet.addRow([row.name, row.sku, row.quantity, row.revenue, row.profit]);
      }
    } else if (kind === 'customers') {
      sheet.addRow(['Client', 'Ventes', 'CA', 'Reste']);
      for (const row of await this.customers()) {
        sheet.addRow([row.name, row.salesCount, row.totalSpent, row.remainingBalance]);
      }
    } else {
      const data = await this.stock();
      sheet.addRow(['Produit', 'Stock', 'CMP', 'Valeur']);
      for (const p of data.products) {
        sheet.addRow([p.name, toNumber(p.currentStock), toNumber(p.purchasePrice), toNumber(p.currentStock) * toNumber(p.purchasePrice)]);
      }
    }
    const filePath = join(dir, `rapport-${kind}-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return { path: filePath };
  }

  async exportPdf(kind: 'sales' | 'products' | 'customers' | 'stock', from?: string, to?: string) {
    const dir = process.env.REPORT_DIR ?? join(process.cwd(), 'storage', 'reports');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `rapport-${kind}-${Date.now()}.pdf`);
    const title =
      kind === 'sales'
        ? 'Rapport des ventes'
        : kind === 'products'
          ? 'Rapport produits'
          : kind === 'customers'
            ? 'Rapport clients'
            : 'Rapport stock';
    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);
      doc.fontSize(16).text(title);
      doc.fontSize(10).text(`Généré le ${new Date().toLocaleString('fr-TN')}`);
      doc.moveDown();
      void (async () => {
        if (kind === 'sales') {
          const d = await this.sales(from, to);
          doc.text(`Ventes : ${d.count}`);
          doc.text(`CA : ${formatMoney(d.revenue)}`);
          doc.text(`Profit : ${formatMoney(d.profit)}`);
          doc.text(`Payé : ${formatMoney(d.paid)}`);
          doc.text(`Reste : ${formatMoney(d.remaining)}`);
        } else if (kind === 'products') {
          for (const row of await this.products(from, to)) {
            doc.text(`${row.name} — qté ${row.quantity} — ${formatMoney(row.revenue)}`);
          }
        } else if (kind === 'customers') {
          for (const row of await this.customers()) {
            doc.text(`${row.name} — ${formatMoney(row.totalSpent)} — reste ${formatMoney(row.remainingBalance)}`);
          }
        } else {
          const d = await this.stock();
          doc.text(`Valeur stock : ${formatMoney(d.stockValue)}`);
          doc.text(`Alertes stock faible : ${d.lowStock.length}`);
        }
        doc.end();
      })();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    return { path: filePath };
  }
}
