import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, role: 'ADMIN' },
  });

  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'CaféStock',
      companyPhone: '+216 00 000 000',
      companyAddress: 'Tunisie',
      currency: 'DT',
      invoiceFooter: 'Merci pour votre confiance.',
    },
  });

  const categoryNames = ['Gobelets', 'Emballage', 'Serviettes', 'Sucre', 'Pailles', 'Divers'];
  const categories: Record<string, { id: string; name: string }> = {};

  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, active: true },
    });
    categories[name] = category;
  }

  const products = [
    {
      name: 'Gobelet 16 oz',
      sku: 'GB-16',
      barcode: '123456789001',
      image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
      category: 'Gobelets',
      unit: 'pièce',
      purchasePrice: 0.45,
      salePrice: 1.2,
      currentStock: 180,
      minimumStock: 40,
    },
    {
      name: 'Gobelet 22 oz',
      sku: 'GB-22',
      barcode: '123456789002',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
      category: 'Gobelets',
      unit: 'pièce',
      purchasePrice: 0.6,
      salePrice: 1.6,
      currentStock: 120,
      minimumStock: 35,
    },
    {
      name: 'Sac café premium',
      sku: 'EMB-CAF-01',
      barcode: '123456789003',
      image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
      category: 'Emballage',
      unit: 'pièce',
      purchasePrice: 0.8,
      salePrice: 2.5,
      currentStock: 90,
      minimumStock: 25,
    },
    {
      name: 'Serviette papier',
      sku: 'SRV-001',
      barcode: '123456789004',
      image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=600&q=80',
      category: 'Serviettes',
      unit: 'boîte',
      purchasePrice: 1.2,
      salePrice: 3.4,
      currentStock: 60,
      minimumStock: 20,
    },
    {
      name: 'Sucre sachet',
      sku: 'SUC-001',
      barcode: '123456789005',
      image: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
      category: 'Sucre',
      unit: 'paquet',
      purchasePrice: 0.9,
      salePrice: 2.2,
      currentStock: 140,
      minimumStock: 30,
    },
    {
      name: 'Pailles bleues',
      sku: 'PAL-001',
      barcode: '123456789006',
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
      category: 'Pailles',
      unit: 'boîte',
      purchasePrice: 0.5,
      salePrice: 1.4,
      currentStock: 200,
      minimumStock: 60,
    },
    {
      name: 'Couvercle plastique',
      sku: 'DIV-001',
      barcode: '123456789007',
      image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
      category: 'Divers',
      unit: 'pièce',
      purchasePrice: 0.25,
      salePrice: 0.9,
      currentStock: 300,
      minimumStock: 80,
    },
  ];

  for (const product of products) {
    const categoryId = categories[product.category]?.id;
    if (!categoryId) continue;

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        barcode: product.barcode,
        image: product.image,
        categoryId,
        unit: product.unit,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        active: true,
      },
      create: {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        image: product.image,
        categoryId,
        unit: product.unit,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        active: true,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
