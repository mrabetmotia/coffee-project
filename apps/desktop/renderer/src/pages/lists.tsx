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
          items: { quantity: string; product: { name: string, image: string } }[];
        }[]
      >('/sales/returns'),
  });
  console.log("data", data)
  return (
    <div>
      <PageHeader title="Retours" />
      <Table>
        <THead>
          <tr>
            <Th>Articles</Th>
            <Th>Facture</Th>
            <Th>Remboursement</Th>
            <Th>Date</Th>
          </tr>
        </THead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <Td><img src={r.items[0]?.product.image || "../images/undefined.png"} alt={r.items[0]?.product.name} className="mr-2 inline-block h-6 w-6 rounded-md border object-cover" /> {r.items.map((i) => `${i.product.name} × ${formatQty(num(i.quantity))}`).join(', ')}</Td>
              <Td>{r.sale.invoiceNumber}</Td>
              <Td>{formatMoney(num(r.refundAmount))}</Td>
              <Td>{new Date(r.createdAt).toLocaleString('fr-TN')}</Td>
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
          product: { name: string; sku: string; image: string };
        }[];
      }>('/stock/movements?take=200'),
  });
  console.log("data", data)
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
                <img
                  src={m.product.image || "../images/undefined.png"}
                  alt={m.product.name}
                  className="mr-2 inline-block h-6 w-6 rounded-md border object-cover"
                />
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
      api<{ id: string; name: string; image: string; sku: string; currentStock: string; minimumStock: string }[]>('/stock/low'),
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
              <Td>
                <img
                  src={p.image || "../images/undefined.png"}
                  alt={p.name}
                  className="mr-2 inline-block h-6 w-6 rounded-md border object-cover"
                />
                {p.name}
              </Td>
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
