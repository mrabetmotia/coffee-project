const QUANTITY_DECIMALS = 3;
const MONEY_DECIMALS = 3;

export function roundMoney(value: number): number {
  return Number(value.toFixed(MONEY_DECIMALS));
}

export function roundQty(value: number): number {
  return Number(value.toFixed(QUANTITY_DECIMALS));
}

/** Format tunisien : 125.500 DT */
export function formatMoney(value: number | string, currency = 'DT'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = safe.toLocaleString('fr-TN', {
    minimumFractionDigits: MONEY_DECIMALS,
    maximumFractionDigits: MONEY_DECIMALS,
  });
  return `${formatted} ${currency}`;
}

export function formatQty(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('fr-TN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: QUANTITY_DECIMALS,
  });
}

export function paymentStatusFromAmounts(total: number, paid: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const remaining = roundMoney(total - paid);
  if (remaining <= 0) return 'PAID';
  if (paid <= 0) return 'UNPAID';
  return 'PARTIAL';
}
