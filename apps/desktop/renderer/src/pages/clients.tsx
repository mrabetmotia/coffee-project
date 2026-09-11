import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { num } from '@/lib/utils';
import { ClientDetailSkeleton } from '@/components/ui/skeleton';

type Client = {
  id: string;
  name: string;
  phone: string | null;
  salesCount: number;
  totalPurchases: number;
  remainingBalance: number;
  paid: number;
};

export function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const { data = [] } = useQuery({ queryKey: ['clients'], queryFn: () => api<Client[]>('/clients') });
  const mut = useMutation({
    mutationFn: () => api('/clients', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title="Clients" actions={<Button onClick={() => setOpen(true)}>Nouveau client</Button>} />
      <Table>
        <THead>
          <tr>
            <Th>Nom</Th>
            <Th>Téléphone</Th>
            <Th>Ventes</Th>
            <Th>CA</Th>
            <Th>Reste</Th>
          </tr>
        </THead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link className="text-primary" to={`/clients/${c.id}`}>
                  {c.name}
                </Link>
              </Td>
              <Td>{c.phone}</Td>
              <Td>{c.salesCount}</Td>
              <Td>{formatMoney(c.totalPurchases)}</Td>
              <Td>{formatMoney(c.remainingBalance)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal.Root open={open} onOpenChange={setOpen}>
        <ModalContent>
          <Modal.Title className="text-lg font-semibold">Nouveau client</Modal.Title>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <Button onClick={() => mut.mutate()}>Enregistrer</Button>
          </div>
        </ModalContent>
      </Modal.Root>
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams();
  const { data } = useQuery({
    queryKey: ['client', id],
    queryFn: () =>
      api<{
        name: string;
        phone: string | null;
        address: string | null;
        salesCount: number;
        totalPurchases: number;
        remainingBalance: number;
        paid: number;
        sales: { id: string; invoiceNumber: string; total: string; remainingAmount: string; createdAt: string }[];
      }>(`/clients/${id}`),
  });
  if (!data) {
    return <ClientDetailSkeleton />;
  }

  return (
    <div>
      <PageHeader title={data.name} subtitle={data.phone ?? ''} />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <Stat label="Ventes" value={String(data.salesCount)} />
        <Stat label="Achats" value={formatMoney(data.totalPurchases)} />
        <Stat label="Payé" value={formatMoney(data.paid)} />
        <Stat label="Solde" value={formatMoney(data.remainingBalance)} />
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Facture</Th>
            <Th>Date</Th>
            <Th>Total</Th>
            <Th>Reste</Th>
          </tr>
        </THead>
        <tbody>
          {data.sales.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link className="text-primary" to={`/ventes/${s.id}`}>
                  {s.invoiceNumber}
                </Link>
              </Td>
              <Td>{new Date(s.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{formatMoney(num(s.total))}</Td>
              <Td>{formatMoney(num(s.remainingAmount))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
