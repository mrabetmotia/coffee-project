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
  const names = ['Gobelets', 'Emballage', 'Serviettes', 'Sucre', 'Pailles', 'Divers'];
  for (const name of names) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, active: true } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
