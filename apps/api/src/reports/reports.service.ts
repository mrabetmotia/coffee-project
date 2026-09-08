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
    const revenue = sales.reduce((s, x) => toNumber(x.total), 0);
    const profit = sales.reduce((s, x) => toNumber(x.profitAmount), 0);
    const paid = sales.reduce((s, x) => toNumber(x.paidAmount), 0);
    const remaining = sales.reduce((s, x) => toNumber(x.remainingAmount), 0);
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
      totalSpent: c.sales.reduce((s, x) => toNumber(x.total), 0),
      remainingBalance: c.sales.reduce((s, x) => toNumber(x.remainingAmount), 0),
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
      (s, p) => toNumber(p.currentStock) * toNumber(p.purchasePrice),
      0,
    );
    const lowStock = products.filter((p) => toNumber(p.currentStock) <= toNumber(p.minimumStock) && p.active);
    return { products, stockValue, lowStock, movements };
  }

  async exportExcel(kind: 'sales' | 'products' | 'customers' | 'stock', from?: string, to?: string) {
    const dir = process.env.REPORT_DIR ?? join(process.cwd(), 'storage', 'reports');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CaféStock';
    workbook.created = new Date();

    const titles: Record<typeof kind, string> = {
      sales: 'Rapport des ventes',
      products: 'Rapport produits',
      customers: 'Rapport clients',
      stock: 'Rapport stock',
    };
    const sheet = workbook.addWorksheet(titles[kind], {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    const teal = 'FF147D72';
    const light = 'FFEDF6F4';
    const ink = 'FF172B2B';
    const money = '#,##0.000 "DT"';

    // --- En-tête du rapport ---
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = titles[kind];
    sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: teal } };
    sheet.mergeCells('A2:E2');
    const periode =
      from || to ? `Période : ${from ?? '…'} → ${to ?? '…'}` : `Généré le ${new Date().toLocaleString('fr-TN')}`;
    sheet.getCell('A2').value = periode;
    sheet.getCell('A2').font = { size: 9, color: { argb: 'FF607474' } };
    sheet.getRow(1).height = 22;

    const styleHeaderRow = (row: ExcelJS.Row) => {
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: teal } };
        cell.alignment = { vertical: 'middle', horizontal: cell.col === '1' ? 'left' : 'right' };
      });
      row.height = 22;
    };

    const styleDataRow = (row: ExcelJS.Row, isEven: boolean) => {
      row.eachCell((cell) => {
        cell.font = { color: { argb: ink } };
        if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: light } };
      });
    };

    if (kind === 'sales') {
      const data = await this.sales(from, to);
      const header = sheet.addRow(['Ventes', 'CA', 'Profit', 'Payé', 'Reste']);
      styleHeaderRow(header);
      sheet.columns = [
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
      ];
      const row = sheet.addRow([data.count, data.revenue, data.profit, data.paid, data.remaining]);
      styleDataRow(row, false);
      ['B', 'C', 'D', 'E'].forEach((col) => (sheet.getCell(`${col}${row.number}`).numFmt = money));
      row.getCell(1).alignment = { horizontal: 'left' };
    } else if (kind === 'products') {
      const header = sheet.addRow(['Produit', 'SKU', 'Qté', 'CA', 'Profit']);
      styleHeaderRow(header);
      sheet.columns = [
        { width: 32 },
        { width: 16 },
        { width: 12 },
        { width: 16 },
        { width: 16 },
      ];
      const rows = await this.products(from, to);
      rows.forEach((r, i) => {
        const row = sheet.addRow([r.name, r.sku, r.quantity, r.revenue, r.profit]);
        styleDataRow(row, i % 2 === 1);
        row.getCell(4).numFmt = money;
        row.getCell(5).numFmt = money;
        row.getCell(1).alignment = { horizontal: 'left' };
        row.getCell(2).alignment = { horizontal: 'left' };
      });
      if (rows.length) {
        const totalRow = sheet.addRow([
          'Total',
          '',
          rows.reduce((s, r) => r.quantity, 0),
          rows.reduce((s, r) => r.revenue, 0),
          rows.reduce((s, r) => r.profit, 0),
        ]);
        totalRow.font = { bold: true, color: { argb: teal } };
        totalRow.getCell(4).numFmt = money;
        totalRow.getCell(5).numFmt = money;
      }
    } else if (kind === 'customers') {
      const header = sheet.addRow(['Client', 'Ventes', 'CA', 'Reste']);
      styleHeaderRow(header);
      sheet.columns = [{ width: 32 }, { width: 12 }, { width: 16 }, { width: 16 }];
      const rows = await this.customers();
      rows.forEach((r, i) => {
        const row = sheet.addRow([r.name, r.salesCount, r.totalSpent, r.remainingBalance]);
        styleDataRow(row, i % 2 === 1);
        row.getCell(3).numFmt = money;
        row.getCell(4).numFmt = money;
        row.getCell(1).alignment = { horizontal: 'left' };
      });
    } else {
      const header = sheet.addRow(['Produit', 'Stock', 'CMP', 'Valeur']);
      styleHeaderRow(header);
      sheet.columns = [{ width: 32 }, { width: 14 }, { width: 16 }, { width: 16 }];
      const data = await this.stock();
      data.products.forEach((p, i) => {
        const row = sheet.addRow([
          p.name,
          toNumber(p.currentStock),
          toNumber(p.purchasePrice),
          toNumber(p.currentStock) * toNumber(p.purchasePrice),
        ]);
        styleDataRow(row, i % 2 === 1);
        row.getCell(3).numFmt = money;
        row.getCell(4).numFmt = money;
        row.getCell(1).alignment = { horizontal: 'left' };
        if (toNumber(p.currentStock) <= toNumber(p.minimumStock) && p.active) {
          row.eachCell((cell) => (cell.font = { ...cell.font, color: { argb: 'FFB3261E' } }));
        }
      });
      const totalRow = sheet.addRow(['Valeur totale du stock', '', '', data.stockValue]);
      totalRow.font = { bold: true, color: { argb: teal } };
      totalRow.getCell(4).numFmt = money;
    }

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9E6E3' } } };
      });
    });

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

    const teal = '#147d72';
    const ink = '#172b2b';
    const muted = '#607474';
    const light = '#edf6f4';
    const line = '#d9e6e3';

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const right = left + pageWidth;
      const money = (v: number) => formatMoney(v);
      const drawRule = (y: number, color = line) => {
        doc.save().strokeColor(color).lineWidth(0.7).moveTo(left, y).lineTo(right, y).stroke().restore();
      };

      // --- En-tête ---
      doc.save().fillColor(teal).roundedRect(left, 42, 42, 42, 10).fill().restore();
      doc.fillColor('#fff').fontSize(19).font('Helvetica-Bold').text('C', left + 13, 53);
      doc.fillColor(ink).fontSize(21).font('Helvetica-Bold').text('CaféStock', left + 56, 46);
      doc.fillColor(muted).fontSize(9).font('Helvetica').text('Gestion commerciale', left + 57, 72);
      doc.fillColor(teal).fontSize(20).font('Helvetica-Bold').text(title, 300, 46, { width: right - 300, align: 'right' });
      const periode = from || to ? `Période : ${from ?? '…'} → ${to ?? '…'}` : `Généré le ${new Date().toLocaleString('fr-TN')}`;
      doc.fillColor(muted).fontSize(9).font('Helvetica').text(periode, 300, 74, { width: right - 300, align: 'right' });
      drawRule(105);
      doc.y = 125;

      const columns = (widths: number[], startX = left) => {
        const xs: number[] = [];
        let x = startX;
        for (const w of widths) {
          xs.push(x);
          x += w;
        }
        return xs;
      };

      const drawHeaderRow = (labels: string[], widths: number[], aligns: ('left' | 'right')[]) => {
        doc.roundedRect(left, doc.y, pageWidth, 26, 6).fillColor(teal).fill();
        const xs = columns(widths);
        const y = doc.y + 8;
        doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
        labels.forEach((label, i) => doc.text(label, xs[i] + 12, y, { width: widths[i] - 16, align: aligns[i] }));
        doc.y += 26;
      };

      const drawDataRow = (values: string[], widths: number[], aligns: ('left' | 'right')[], isEven: boolean, highlight = false) => {
        const y = doc.y;
        if (isEven) doc.rect(left, y - 4, pageWidth, 22).fillColor(light).fill();
        const xs = columns(widths);
        doc.fillColor(highlight ? '#b3261e' : ink).fontSize(9.5).font('Helvetica');
        values.forEach((v, i) => doc.text(v, xs[i] + 12, y, { width: widths[i] - 16, align: aligns[i] }));
        doc.y += 22;
      };

      if (kind === 'sales') {
        void this.sales(from, to).then((d) => {
          const widths = [pageWidth / 2, pageWidth / 2];
          drawHeaderRow(['INDICATEUR', 'VALEUR'], widths, ['left', 'right']);
          const rows: [string, string][] = [
            ['Ventes', String(d.count)],
            ['Chiffre d’affaires', money(d.revenue)],
            ['Profit', money(d.profit)],
            ['Payé', money(d.paid)],
            ['Reste', money(d.remaining)],
          ];
          rows.forEach((r, i) => drawDataRow(r, widths, ['left', 'right'], i % 2 === 1));
          finish();
        });
      } else if (kind === 'products') {
        void this.products(from, to).then((rows) => {
          const widths = [pageWidth * 0.45, pageWidth * 0.2, pageWidth * 0.17, pageWidth * 0.18];
          drawHeaderRow(['PRODUIT', 'SKU', 'QTÉ', 'CA'], widths, ['left', 'left', 'right', 'right']);
          rows.forEach((r, i) =>
            drawDataRow([r.name, r.sku, String(r.quantity), money(r.revenue)], widths, ['left', 'left', 'right', 'right'], i % 2 === 1),
          );
          drawRule(doc.y + 2);
          doc.y += 12;
          doc.fillColor(teal).fontSize(11).font('Helvetica-Bold').text(`Total CA : ${money(rows.reduce((s, r) =>  r.revenue, 0))}`, left, doc.y, {
            width: pageWidth,
            align: 'right',
          });
          finish();
        });
      } else if (kind === 'customers') {
        void this.customers().then((rows) => {
          const widths = [pageWidth * 0.45, pageWidth * 0.18, pageWidth * 0.18, pageWidth * 0.19];
          drawHeaderRow(['CLIENT', 'VENTES', 'CA', 'RESTE'], widths, ['left', 'right', 'right', 'right']);
          rows.forEach((r, i) =>
            drawDataRow(
              [r.name, String(r.salesCount), money(r.totalSpent), money(r.remainingBalance)],
              widths,
              ['left', 'right', 'right', 'right'],
              i % 2 === 1,
              r.remainingBalance > 0,
            ),
          );
          finish();
        });
      } else {
        void this.stock().then((d) => {
          doc.fillColor(ink).fontSize(11).font('Helvetica-Bold').text(`Valeur totale du stock : ${money(d.stockValue)}`);
          doc.fillColor(muted).fontSize(9).font('Helvetica').text(`Alertes stock faible : ${d.lowStock.length}`);
          doc.moveDown(0.5);
          const widths = [pageWidth * 0.4, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.2];
          drawHeaderRow(['PRODUIT', 'STOCK', 'CMP', 'VALEUR'], widths, ['left', 'right', 'right', 'right']);
          d.products.forEach((p, i) => {
            const isLow = toNumber(p.currentStock) <= toNumber(p.minimumStock) && p.active;
            drawDataRow(
              [
                p.name,
                String(toNumber(p.currentStock)),
                money(toNumber(p.purchasePrice)),
                money(toNumber(p.currentStock) * toNumber(p.purchasePrice)),
              ],
              widths,
              ['left', 'right', 'right', 'right'],
              i % 2 === 1,
              isLow,
            );
          });
          finish();
        });
      }

      const finish = () => {
        drawRule(doc.page.height - 60);
        doc.fillColor(muted).fontSize(8).font('Helvetica').text('CaféStock · Document généré automatiquement', left, doc.page.height - 48);
        doc.end();
      };

      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    return { path: filePath };
  }
}
