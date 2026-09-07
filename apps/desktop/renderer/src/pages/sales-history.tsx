import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from '@cafestock/shared';
import { api } from '@/lib/api';
import { PageHeader, formatMoney } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { num } from '@/lib/utils';
import { useState } from 'react';

type Sale = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  total: string;
  paidAmount: string;
  remainingAmount: string;
  profitAmount: string;
  paymentStatus: PaymentStatus;
  client: { name: string } | null;
};

export function SalesHistoryPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data } = useQuery({
    queryKey: ['sales', q, status],
    queryFn: () =>
      api<{ items: Sale[] }>(
        `/sales?q=${encodeURIComponent(q)}&paymentStatus=${status}&take=100`,
      ),
  });
  const statusVariant = (s: PaymentStatus) =>
    s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : 'destructive';

  return (
    <div>
      <PageHeader title="Historique des ventes" />
      <div className="mb-4 flex gap-2">
        <Input placeholder="N° facture ou client" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les paiements</option>
          <option value="PAID">Payé</option>
          <option value="PARTIAL">Partiel</option>
          <option value="UNPAID">Impayé</option>
        </select>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Facture</Th>
            <Th>Date</Th>
            <Th>Client</Th>
            <Th>Total</Th>
            <Th>Payé</Th>
            <Th>Reste</Th>
            <Th>Profit</Th>
            <Th>Statut</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.items ?? []).map((s) => (
            <tr key={s.id}>
              <Td>
                <Link className="text-primary hover:underline" to={`/ventes/${s.id}`}>
                  {s.invoiceNumber}
                </Link>
              </Td>
              <Td>{new Date(s.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{s.client?.name ?? 'Vente comptoir'}</Td>
              <Td>{formatMoney(num(s.total))}</Td>
              <Td>{formatMoney(num(s.paidAmount))}</Td>
              <Td>{formatMoney(num(s.remainingAmount))}</Td>
              <Td>{formatMoney(num(s.profitAmount))}</Td>
              <Td>
                <Badge variant={statusVariant(s.paymentStatus)}>{PAYMENT_STATUS_LABELS[s.paymentStatus]}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
