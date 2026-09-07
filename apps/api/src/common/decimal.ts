import { Prisma } from '@prisma/client';

export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
}

export function roundMoney(n: number): number {
  return Number(n.toFixed(3));
}

export function roundQty(n: number): number {
  return Number(n.toFixed(3));
}
