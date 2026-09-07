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
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const right = left + pageWidth;
      const teal = '#147d72';
      const ink = '#172b2b';
      const muted = '#607474';
      const light = '#edf6f4';
      const line = '#d9e6e3';
      const money = (value: number) => formatMoney(value, currency);
      const drawRule = (y: number, color = line) => {
        doc.save().strokeColor(color).lineWidth(0.7).moveTo(left, y).lineTo(right, y).stroke().restore();
      };

      // Brand header and invoice identity.
      doc.save().fillColor(teal).roundedRect(left, 42, 42, 42, 10).fill().restore();
      doc.fillColor('#fff').fontSize(19).font('Helvetica-Bold').text('C', left + 13, 53);
      doc.fillColor(ink).fontSize(21).font('Helvetica-Bold').text(settings?.companyName ?? 'CaféStock', left + 56, 46);
      doc.fillColor(muted).fontSize(9).font('Helvetica').text('Gestion commerciale', left + 57, 72);
      doc.fillColor(teal).fontSize(25).font('Helvetica-Bold').text('FACTURE', 390, 46, { width: right - 390, align: 'right' });
      doc.fillColor(muted).fontSize(10).font('Helvetica').text(`#${invoice.number}`, 390, 76, { width: right - 390, align: 'right' });

      doc.y = 105;
      doc.fillColor(muted).fontSize(9).font('Helvetica');
      if (settings?.companyAddress) doc.text(settings.companyAddress, left, doc.y, { width: 240 });
      if (settings?.companyPhone) doc.text(settings.companyPhone, left, doc.y, { width: 240 });
      doc.roundedRect(350, 102, right - 350, 55, 8).fillColor(light).fill();
      doc.fillColor(muted).fontSize(8).text('DATE D’EMISSION', 365, 114);
      doc.fillColor(ink).fontSize(10).font('Helvetica-Bold').text(invoice.sale.createdAt.toLocaleDateString('fr-TN'), 365, 128);
      doc.fillColor(muted).fontSize(8).font('Helvetica').text('CLIENT', 465, 114);
      doc.fillColor(ink).fontSize(10).font('Helvetica-Bold').text(invoice.sale.client?.name ?? 'Vente comptoir', 465, 128, { width: 68, align: 'right' });

      doc.y = 190;
      doc.fillColor(ink).fontSize(11).font('Helvetica-Bold').text('Détail de la commande');
      doc.y += 12;
      doc.roundedRect(left, doc.y, pageWidth, 28, 6).fillColor(teal).fill();
      const headerY = doc.y + 9;
      doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold').text('PRODUIT', left + 14, headerY, { width: 215 });
      doc.text('QTÉ', 285, headerY, { width: 45, align: 'right' });
      doc.text('PRIX UNITAIRE', 335, headerY, { width: 85, align: 'right' });
      doc.text('TOTAL', 445, headerY, { width: 88, align: 'right' });
      doc.y += 38;
      for (const item of invoice.sale.items) {
        const qty = toNumber(item.quantity) - toNumber(item.returnedQuantity);
        if (qty <= 0) continue;
        const y = doc.y;
        doc.fillColor(ink).fontSize(9.5).font('Helvetica').text(item.product.name, left + 14, y, { width: 215 });
        doc.fillColor(muted).text(formatQty(qty), 285, y, { width: 45, align: 'right' });
        doc.text(money(toNumber(item.unitPrice)), 335, y, { width: 85, align: 'right' });
        doc.fillColor(ink).font('Helvetica-Bold').text(money(toNumber(item.unitPrice) * qty), 445, y, { width: 88, align: 'right' });
        doc.y = Math.max(y + 26, doc.y + 8);
        drawRule(doc.y - 5);
      }

      const totalsTop = doc.y + 24;
      const boxHeight = 126;
      doc.roundedRect(330, totalsTop, right - 330, boxHeight, 8).fillColor('#f7faf9').fill();
      doc.fillColor(muted).fontSize(9).font('Helvetica').text('Sous-total', 350, totalsTop + 18);
      doc.fillColor(ink).text(money(toNumber(invoice.sale.subtotal)), 445, totalsTop + 18, { width: 88, align: 'right' });
      doc.fillColor(muted).text('Remise', 350, totalsTop + 39);
      doc.fillColor(ink).text(money(toNumber(invoice.sale.discountAmount)), 445, totalsTop + 39, { width: 88, align: 'right' });
      doc.fillColor(teal).fontSize(12).font('Helvetica-Bold').text('Total', 350, totalsTop + 73);
      doc.text(money(toNumber(invoice.sale.total)), 445, totalsTop + 71, { width: 88, align: 'right' });
      doc.fillColor(muted).fontSize(9).font('Helvetica').text('Payé', 350, totalsTop + 99);
      doc.fillColor(ink).text(money(toNumber(invoice.sale.paidAmount)), 445, totalsTop + 99, { width: 88, align: 'right' });
      doc.fillColor(muted).text('Reste', 350, totalsTop + 117);
      doc.fillColor(ink).text(money(toNumber(invoice.sale.remainingAmount)), 445, totalsTop + 117, { width: 88, align: 'right' });

      const stampWidth = 150;
      const stampHeight = 80;
      const stampTop = 745 - 20 - stampHeight; // marge de 20 avant la ligne du footer
      doc.save()
        .strokeColor(line)
        .lineWidth(1)
        .dash(4, { space: 3 })
        .roundedRect(right - stampWidth, stampTop, stampWidth, stampHeight, 8)
        .stroke()
        .undash()
        .restore();
      doc.fillColor(muted).fontSize(8).font('Helvetica').text('CACHET ET SIGNATURE', right - stampWidth, stampTop + stampHeight - 20, {
        width: stampWidth,
        align: 'center',
      });

      drawRule(745);
      doc.fillColor(muted).fontSize(8).text(`${settings?.companyName ?? 'CaféStock'}  ·  Document officiel`, left, 760);
      doc.text(invoice.number, 450, 760, { width: 83, align: 'right' });
      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    await this.prisma.invoice.update({ where: { id }, data: { pdfPath: filePath } });
    return filePath;
  }
}
