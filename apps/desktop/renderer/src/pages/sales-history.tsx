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
import { Pagination } from '@/components/ui/pagination';
import { GenericPageSkeleton } from '@/components/ui/skeleton';

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
  const [page, setPage] = useState(0);
  const take = 12;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales', q, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ take: String(take), skip: String(page * take) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('paymentStatus', status);
      return api<{ items: Sale[]; total: number }>(`/sales?${params.toString()}`);
    },
  });
  const statusVariant = (s: PaymentStatus) =>
    s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : 'destructive';

  if (isLoading) return <GenericPageSkeleton rows={6} cols={8} />;

  return (
    <div>
      <PageHeader title="Historique des ventes" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
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
          {isLoading ? (
            <tr>
              <Td colSpan={8} className="py-5">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-md bg-muted/70" />
                  ))}
                </div>
              </Td>
            </tr>
          ) : null}
          {isError ? (
            <tr>
              <Td colSpan={8} className="py-12 text-center text-destructive">Impossible de charger l’historique des ventes.</Td>
            </tr>
          ) : null}
          {!isLoading && !isError && (data?.items ?? []).length === 0 ? (
            <tr>
              <Td colSpan={8} className="py-12 text-center text-muted-foreground">Aucune vente trouvée.</Td>
            </tr>
          ) : null}
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
      <Pagination page={page} total={data?.total ?? 0} take={take} onPageChange={(next) => setPage(next)} />
    </div>
  );
}
