import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  client: { name: string } | null;
  items: {
    id: string;
    quantity: string;
    returnedQuantity: string;
    unitPrice: string;
    lineTotal: string;
    product: { name: string, image: string };
  }[];
  payments: { id: string; amount: string; method: string; createdAt: string }[];
  invoice: { id: string };
};

export function SaleDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => api<Sale>(`/sales/${id}`),
  });
  const [pay, setPay] = useState(0);
  const [returns, setReturns] = useState<Record<string, number>>({});

  const payMut = useMutation({
    mutationFn: () => api('/payments', { method: 'POST', body: JSON.stringify({ saleId: id, amount: pay, method: 'CASH' }) }),
    onSuccess: () => {
      toast.success('Paiement enregistré');
      void qc.invalidateQueries({ queryKey: ['sale', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retMut = useMutation({
    mutationFn: () =>
      api(`/sales/${id}/returns`, {
        method: 'POST',
        body: JSON.stringify({
          items: Object.entries(returns)
            .filter(([, q]) => q > 0)
            .map(([saleItemId, quantity]) => ({ saleItemId, quantity })),
        }),
      }),
    onSuccess: () => {
      toast.success('Retour enregistré');
      void qc.invalidateQueries({ queryKey: ['sale', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pdfMut = useMutation({
    mutationFn: () => api<{ path: string }>(`/invoices/${data?.invoice.id}/pdf`, { method: 'POST' }),
    onSuccess: async (res) => {
      toast.success('PDF généré');
      await window.cafestock?.openPath(res.path);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <p>Chargement…</p>;

  return (
    <div>
      <PageHeader
        title={data.invoiceNumber}
        subtitle={`${data.client?.name ?? 'Vente comptoir'} · ${new Date(data.createdAt).toLocaleString('fr-TN')}`}
        actions={
          <Button onClick={() => pdfMut.mutate()} variant="outline">
            PDF / Imprimer
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <tr>
                  <Th>Produit</Th>
                  <Th>Qté</Th>
                  <Th>Retourné</Th>
                  <Th>P.U.</Th>
                  <Th>Total</Th>
                  <Th>Retour</Th>
                </tr>
              </THead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <Td className="flex items-center gap-2">
                      <img src={i.product?.image || "../images/undefined.png"} alt={i.product.name} className="h-10 w-10 rounded-md border object-cover" />
                      {i.product.name}
                    </Td>
                    <Td>{formatQty(num(i.quantity))}</Td>
                    <Td>{formatQty(num(i.returnedQuantity))}</Td>
                    <Td>{formatMoney(num(i.unitPrice))}</Td>
                    <Td>{formatMoney(num(i.lineTotal))}</Td>
                    <Td>
                      <Input
                        type="number"
                        className="h-8 w-20"
                        min={0}
                        max={num(i.quantity) - num(i.returnedQuantity)}
                        value={returns[i.id] ?? 0}
                        onChange={(e) => setReturns((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Button className="mt-3" variant="outline" onClick={() => retMut.mutate()}>
              Valider le retour
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Totaux</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span>{formatMoney(num(data.total))}</span>
              </div>
              <div className="flex justify-between">
                <span>Payé</span>
                <span>{formatMoney(num(data.paidAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span>Reste</span>
                <span>{formatMoney(num(data.remainingAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit</span>
                <span>{formatMoney(num(data.profitAmount))}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Encaisser</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input type="number" step={0.001} value={pay} onChange={(e) => setPay(Number(e.target.value))} />
              <Button className="w-full" disabled={num(data.remainingAmount) <= 0} onClick={() => payMut.mutate()}>
                Enregistrer le paiement
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
