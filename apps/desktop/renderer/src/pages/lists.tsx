import { useQuery } from '@tanstack/react-query';
import { MOVEMENT_TYPE_LABELS, type StockMovementType } from '@cafestock/shared';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { num } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function ReturnsPage() {
  const { data = [] } = useQuery({
    queryKey: ['returns'],
    queryFn: () =>
      api<
        {
          id: string;
          createdAt: string;
          refundAmount: string;
          sale: { invoiceNumber: string };
          items: { quantity: string; product: { name: string } }[];
        }[]
      >('/sales/returns'),
  });
  return (
    <div>
      <PageHeader title="Retours" />
      <Table>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Facture</Th>
            <Th>Articles</Th>
            <Th>Remboursement</Th>
          </tr>
        </THead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <Td>{new Date(r.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{r.sale.invoiceNumber}</Td>
              <Td>{r.items.map((i) => `${i.product.name} × ${formatQty(num(i.quantity))}`).join(', ')}</Td>
              <Td>{formatMoney(num(r.refundAmount))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function MovementsPage() {
  const { data } = useQuery({
    queryKey: ['movements'],
    queryFn: () =>
      api<{
        items: {
          id: string;
          type: StockMovementType;
          quantity: string;
          stockBefore: string;
          stockAfter: string;
          reason: string | null;
          reference: string | null;
          createdAt: string;
          product: { name: string; sku: string };
        }[];
      }>('/stock/movements?take=200'),
  });
  return (
    <div>
      <PageHeader title="Mouvements de stock" />
      <Table>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Produit</Th>
            <Th>Type</Th>
            <Th>Qté</Th>
            <Th>Avant</Th>
            <Th>Après</Th>
            <Th>Réf.</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.items ?? []).map((m) => (
            <tr key={m.id}>
              <Td>{new Date(m.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>
                {m.product.name} <span className="text-muted-foreground">{m.product.sku}</span>
              </Td>
              <Td>{MOVEMENT_TYPE_LABELS[m.type]}</Td>
              <Td>{formatQty(num(m.quantity))}</Td>
              <Td>{formatQty(num(m.stockBefore))}</Td>
              <Td>{formatQty(num(m.stockAfter))}</Td>
              <Td>{m.reference}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function LowStockPage() {
  const { data = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () =>
      api<{ id: string; name: string; sku: string; currentStock: string; minimumStock: string }[]>('/stock/low'),
  });
  return (
    <div>
      <PageHeader title="Stock faible" subtitle="Produits au seuil ou en dessous" />
      <Table>
        <THead>
          <tr>
            <Th>Produit</Th>
            <Th>SKU</Th>
            <Th>Stock</Th>
            <Th>Minimum</Th>
          </tr>
        </THead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id}>
              <Td>{p.name}</Td>
              <Td>{p.sku}</Td>
              <Td>{formatQty(num(p.currentStock))}</Td>
              <Td>{formatQty(num(p.minimumStock))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function CashPage() {
  const { data } = useQuery({
    queryKey: ['cash'],
    queryFn: () =>
      api<{
        openingBalance: number;
        salesCashPayments: number;
        refunds: number;
        currentBalance: number;
        transactions: { id: string; type: string; amount: string; createdAt: string; notes: string | null }[];
      }>('/cash'),
  });
  return (
    <div>
      <PageHeader title="Caisse" subtitle="Encaissements espèces uniquement" />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ['Ouverture', data?.openingBalance],
          ['Encaissements', data?.salesCashPayments],
          ['Remboursements', data?.refunds],
          ['Solde', data?.currentBalance],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase text-muted-foreground">{l}</div>
            <div className="mt-1 text-xl font-semibold">{formatMoney(Number(v ?? 0))}</div>
          </div>
        ))}
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Montant</Th>
            <Th>Notes</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.transactions ?? []).map((t) => (
            <tr key={t.id}>
              <Td>{new Date(t.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{t.type}</Td>
              <Td>{formatMoney(num(t.amount))}</Td>
              <Td>{t.notes}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export function InvoicesPage() {
  const { data } = useQuery({
    queryKey: ['invoices'],
    queryFn: () =>
      api<{
        items: {
          id: string;
          number: string;
          createdAt: string;
          sale: { id: string; total: string; client: { name: string } | null };
        }[];
      }>('/invoices'),
  });
  return (
    <div>
      <PageHeader title="Factures" />
      <Table>
        <THead>
          <tr>
            <Th>N°</Th>
            <Th>Date</Th>
            <Th>Client</Th>
            <Th>Total</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.items ?? []).map((i) => (
            <tr key={i.id}>
              <Td>
                <Link className="text-primary" to={`/ventes/${i.sale.id}`}>
                  {i.number}
                </Link>
              </Td>
              <Td>{new Date(i.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{i.sale.client?.name ?? 'Vente comptoir'}</Td>
              <Td>{formatMoney(num(i.sale.total))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
