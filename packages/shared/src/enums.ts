export const UserRole = {
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PaymentMethod = {
  CASH: 'CASH',
  CHECK: 'CHECK',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const StockMovementType = {
  ENTRY: 'ENTRY',
  SALE: 'SALE',
  CUSTOMER_RETURN: 'CUSTOMER_RETURN',
  LOSS: 'LOSS',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const CashTransactionType = {
  OPENING: 'OPENING',
  SALE_PAYMENT: 'SALE_PAYMENT',
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
  REFUND: 'REFUND',
} as const;
export type CashTransactionType = (typeof CashTransactionType)[keyof typeof CashTransactionType];

export const SaleStatus = {
  FINALIZED: 'FINALIZED',
  PARTIALLY_RETURNED: 'PARTIALLY_RETURNED',
  RETURNED: 'RETURNED',
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  TRANSFER: 'Virement',
  OTHER: 'Autre',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Impayé',
  PARTIAL: 'Partiel',
  PAID: 'Payé',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  ENTRY: 'Entrée',
  SALE: 'Vente',
  CUSTOMER_RETURN: 'Retour client',
  LOSS: 'Perte',
  ADJUSTMENT: 'Ajustement',
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  FINALIZED: 'Finalisée',
  PARTIALLY_RETURNED: 'Retour partiel',
  RETURNED: 'Retournée',
};
