import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { num } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleDollarSign, CreditCard, PackageCheck, ShoppingBag, WalletCards } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Dash = {
  revenue: number;
  profit: number;
  salesCount: number;
  productsSold: number;
  collected: number;
  remainingBalances: number;
  chart: { date: string; sales: number; profit: number }[];
  bestSellers: { name: string; qty: number }[];
  lowStock: { id: string; name: string; currentStock: string; minimumStock: string }[];
  recentSales: { id: string; invoiceNumber: string; total: string; createdAt: string }[];
  recentEntries: { id: string; number: string; totalCost: string; createdAt: string }[];
  recentPayments: { id: string; amount: string; createdAt: string; sale: { invoiceNumber: string } }[];
};

export function DashboardPage() {
  const [period, setPeriod] = useState('today');
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api<Dash>(`/dashboard?period=${period}`),
  });

  const kpis = useMemo(
    () => [
      { label: 'Chiffre d’affaires', value: formatMoney(data?.revenue ?? 0), icon: CircleDollarSign, tone: 'text-primary bg-accent' },
      { label: 'Profit net', value: formatMoney(data?.profit ?? 0), icon: ArrowUpRight, tone: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40' },
      { label: 'Ventes', value: String(data?.salesCount ?? 0), icon: ShoppingBag, tone: 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/40' },
      { label: 'Produits vendus', value: formatQty(data?.productsSold ?? 0), icon: PackageCheck, tone: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40' },
      { label: 'Encaissé', value: formatMoney(data?.collected ?? 0), icon: CreditCard, tone: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40' },
      { label: 'Soldes clients', value: formatMoney(data?.remainingBalances ?? 0), icon: WalletCards, tone: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40' },
    ],
    [data],
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Vue d’ensemble de l’activité"
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[180px] rounded-md border bg-background px-3 text-sm shadow-none">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd’hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      <div key={period} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', k.tone)}><k.icon className="h-4 w-4" /></div>
              <CardTitle className="text-right text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 text-xl font-semibold tracking-tight">{k.value}</CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div><p className="eyebrow mb-1">Performance</p><CardTitle>Ventes et profit</CardTitle></div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chart ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="sales" name="CA" stroke="#1e3a5f" fill="#1e3a5f22" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" fill="#3b82f622" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div><p className="eyebrow mb-1">Top produits</p><CardTitle>Meilleures ventes</CardTitle></div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.bestSellers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              data?.bestSellers.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 text-sm last:border-0">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{formatQty(p.qty)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Stock faible</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.lowStock ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun produit sous seuil.</p>
            ) : (
              data?.lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 text-sm last:border-0">
                    <span className="truncate font-medium">{p.name}</span>
                  <Badge variant="warning">
                    {formatQty(num(p.currentStock))} / {formatQty(num(p.minimumStock))}
                  </Badge>
                </div>
              ))
            )}
            <Link to="/stock/faible" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Voir tout
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <ListCard title="Ventes récentes" rows={data?.recentSales ?? []} get={(s) => s.invoiceNumber} extra={(s) => formatMoney(num(s.total))} to={(s) => `/ventes/${s.id}`} />
        <ListCard title="Entrées récentes" rows={data?.recentEntries ?? []} get={(s) => s.number} extra={(s) => formatMoney(num(s.totalCost))} />
        <ListCard title="Paiements récents" rows={data?.recentPayments ?? []} get={(s) => s.sale.invoiceNumber} extra={(s) => formatMoney(num(s.amount))} />
      </div>
    </div>
  );
}

function ListCard<T extends { id: string; createdAt: string }>({
  title,
  rows,
  get,
  extra,
  to,
}: {
  title: string;
  rows: T[];
  get: (r: T) => string;
  extra: (r: T) => string;
  to?: (r: T) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Rien à afficher.</p> : null}
        {rows.map((r) => {
          const inner = (
            <div className="flex justify-between text-sm">
              <span>{get(r)}</span>
              <span className="text-muted-foreground">{extra(r)}</span>
            </div>
          );
          return to ? (
            <Link key={r.id} to={to(r)} className="block hover:underline">
              {inner}
            </Link>
          ) : (
            <div key={r.id}>{inner}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
