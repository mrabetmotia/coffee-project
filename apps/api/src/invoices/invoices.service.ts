import { HttpStatus, Injectable } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.module';
import { BusinessException } from '../common/business.exception';
import { formatMoney, formatQty } from '@cafestock/shared';
import { toNumber } from '../common/decimal';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(skip = 0, take = 50) {
    return this.prisma.$transaction([
      this.prisma.invoice.findMany({
        include: { sale: { include: { client: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count(),
    ]).then(([items, total]) => ({ items, total }));
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        sale: { include: { client: true, items: { include: { product: true } }, payments: true } },
      },
    });
    if (!invoice) {
      throw new BusinessException('Facture introuvable.', HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return invoice;
  }

  async generatePdf(id: string): Promise<string> {
    const invoice = await this.findOne(id);
    const settings = await this.prisma.companySettings.findUnique({ where: { id: 'default' } });
    const dir = process.env.INVOICE_DIR ?? join(process.cwd(), 'storage', 'invoices');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${invoice.number}.pdf`);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(filePath);
      doc.pipe(stream);
      const currency = settings?.currency ?? 'DT';
      doc.fontSize(18).text(settings?.companyName ?? 'CaféStock', { align: 'left' });
      doc.fontSize(10).fillColor('#444');
      if (settings?.companyAddress) doc.text(settings.companyAddress);
      if (settings?.companyPhone) doc.text(settings.companyPhone);
      doc.moveDown();
      doc.fillColor('#111').fontSize(16).text(`Facture ${invoice.number}`);
      doc.fontSize(10).text(`Date : ${invoice.sale.createdAt.toLocaleString('fr-TN')}`);
      doc.text(`Client : ${invoice.sale.client?.name ?? 'Vente comptoir'}`);
      doc.moveDown();
      doc.fontSize(10).text('Produit', 48, doc.y, { continued: true, width: 220 });
      doc.text('Qté', 270, doc.y, { continued: true, width: 60 });
      doc.text('P.U.', 330, doc.y, { continued: true, width: 90 });
      doc.text('Total', 420, doc.y);
      doc.moveTo(48, doc.y + 4).lineTo(547, doc.y + 4).stroke();
      doc.moveDown();
      for (const item of invoice.sale.items) {
        const qty = toNumber(item.quantity) - toNumber(item.returnedQuantity);
        if (qty <= 0) continue;
        const y = doc.y;
        doc.text(item.product.name, 48, y, { width: 210 });
        doc.text(formatQty(qty), 270, y, { width: 60 });
        doc.text(formatMoney(toNumber(item.unitPrice), currency), 330, y, { width: 90 });
        doc.text(formatMoney(toNumber(item.unitPrice) * qty, currency), 420, y);
        doc.moveDown();
      }
      doc.moveDown();
      doc.text(`Sous-total : ${formatMoney(toNumber(invoice.sale.subtotal), currency)}`, { align: 'right' });
      doc.text(`Remise : ${formatMoney(toNumber(invoice.sale.discountAmount), currency)}`, { align: 'right' });
      doc.fontSize(12).text(`Total : ${formatMoney(toNumber(invoice.sale.total), currency)}`, { align: 'right' });
      doc.fontSize(10).text(`Payé : ${formatMoney(toNumber(invoice.sale.paidAmount), currency)}`, { align: 'right' });
      doc.text(`Reste : ${formatMoney(toNumber(invoice.sale.remainingAmount), currency)}`, { align: 'right' });
      if (settings?.invoiceFooter) {
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#666').text(settings.invoiceFooter, { align: 'center' });
      }
      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    await this.prisma.invoice.update({ where: { id }, data: { pdfPath: filePath } });
    return filePath;
  }
}
