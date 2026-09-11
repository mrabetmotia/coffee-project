import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowUpRight, CircleDollarSign, CreditCard, FileDown, Package, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportsPageSkeleton } from '@/components/ui/skeleton';

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = `from=${from}&to=${to}`;

  const { data: sales, isLoading: salesLoading } = useQuery({
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


  if (salesLoading) return <ReportsPageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        subtitle="Vue d’ensemble financière et commerciale"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card p-1 shadow-[0_8px_30px_hsl(var(--foreground)/0.04)]">
            <label className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Du</span>
              <input className="bg-transparent text-sm text-foreground outline-none" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Au</span>
              <input className="bg-transparent text-sm text-foreground outline-none" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Ventes</p>
              <CardTitle>Performance commerciale</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Nombre de ventes</p>
                <p className="mt-1 text-xl font-semibold">{sales?.count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Valeur du stock</p>
                <p className="mt-1 text-xl font-semibold">{formatMoney(stock?.stockValue ?? 0)}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="text-muted-foreground">CA</span>
                <span className="font-semibold">{formatMoney(sales?.revenue ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(sales?.profit ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="text-muted-foreground">Alerte stock</span>
                <span className="font-semibold">{stock?.lowStock.length ?? 0}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => exp.mutate('sales')}>
                <FileDown className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => pdf.mutate('sales')}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Stock</p>
              <CardTitle>Suivi du stock</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Valeur totale</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(stock?.stockValue ?? 0)}</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="text-muted-foreground">Articles sous seuil</span>
                <span className="font-semibold">{stock?.lowStock.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                <span className="text-muted-foreground">État</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <ArrowUpRight className="h-3 w-3" />
                  À surveiller
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => exp.mutate('stock')}>
                <FileDown className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => pdf.mutate('stock')}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Produits</p>
                <CardTitle>Top produits</CardTitle>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Package className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit pour cette période.</p>
            ) : (
              products.slice(0, 8).map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{formatMoney(p.revenue)}</span>
                </div>
              ))
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => exp.mutate('products')}>
                <FileDown className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => pdf.mutate('products')}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Clients</p>
                <CardTitle>Comptes clients</CardTitle>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun client à afficher.</p>
            ) : (
              customers.slice(0, 8).map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{formatMoney(c.remainingBalance)}</span>
                </div>
              ))
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => exp.mutate('customers')}>
                <FileDown className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => pdf.mutate('customers')}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
