import { Prisma, PrismaClient } from '@prisma/client';

export type DbClient = Prisma.TransactionClient | PrismaClient;

export async function nextDocumentNumber(
  db: DbClient,
  key: 'FAC' | 'ENT' | 'INV',
  year = new Date().getFullYear(),
): Promise<string> {
  const existing = await db.documentCounter.findUnique({
    where: { key_year: { key, year } },
  });
  const last = existing?.lastNumber ?? 0;
  const next = last + 1;
  if (existing) {
    await db.documentCounter.update({
      where: { id: existing.id },
      data: { lastNumber: next },
    });
  } else {
    await db.documentCounter.create({ data: { key, year, lastNumber: next } });
  }
  return `${key}-${year}-${String(next).padStart(5, '0')}`;
}
