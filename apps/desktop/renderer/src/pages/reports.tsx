import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = `from=${from}&to=${to}`;
  const { data: sales } = useQuery({
    queryKey: ['rep-sales', from, to],
    queryFn: () => api<{ count: number; revenue: number; profit: number; paid: number; remaining: number }>(`/reports/sales?${qs}`),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['rep-products', from, to],
    queryFn: () => api<{ name: string; quantity: number; revenue: number; profit: number }[]>(`/reports/products?${qs}`),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['rep-cust'],
    queryFn: () => api<{ name: string; salesCount: number; totalSpent: number; remainingBalance: number }[]>('/reports/customers'),
  });
  const { data: stock } = useQuery({
    queryKey: ['rep-stock'],
    queryFn: () => api<{ stockValue: number; lowStock: unknown[] }>('/reports/stock'),
  });
  const exp = useMutation({
    mutationFn: (kind: string) => api<{ path: string }>(`/reports/export/excel?kind=${kind}&${qs}`),
    onSuccess: async (r) => {
      toast.success('Export Excel');
      await window.cafestock?.openPath(r.path);
    },
  });
  const pdf = useMutation({
    mutationFn: (kind: string) => api<{ path: string }>(`/reports/export/pdf?kind=${kind}&${qs}`),
    onSuccess: async (r) => {
      toast.success('Export PDF');
      await window.cafestock?.openPath(r.path);
    },
  });

  return (
    <div>
      <PageHeader
        title="Rapports"
        actions={
          <div className="flex gap-2">
            <input className="h-9 rounded-md border bg-background px-2 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input className="h-9 rounded-md border bg-background px-2 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Nombre : {sales?.count ?? 0}</p>
            <p>CA : {formatMoney(sales?.revenue ?? 0)}</p>
            <p>Profit : {formatMoney(sales?.profit ?? 0)}</p>
            <p>Payé : {formatMoney(sales?.paid ?? 0)}</p>
            <p>Reste : {formatMoney(sales?.remaining ?? 0)}</p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => exp.mutate('sales')}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => pdf.mutate('sales')}>PDF</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Valeur : {formatMoney(stock?.stockValue ?? 0)}</p>
            <p>Alertes : {stock?.lowStock.length ?? 0}</p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => exp.mutate('stock')}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => pdf.mutate('stock')}>PDF</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Produits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {products.slice(0, 8).map((p) => (
              <div key={p.name} className="flex justify-between">
                <span>{p.name}</span>
                <span>{formatMoney(p.revenue)}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => exp.mutate('products')}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => pdf.mutate('products')}>PDF</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {customers.slice(0, 8).map((c) => (
              <div key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span>{formatMoney(c.remainingBalance)}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => exp.mutate('customers')}>Excel</Button>
              <Button size="sm" variant="outline" onClick={() => pdf.mutate('customers')}>PDF</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
