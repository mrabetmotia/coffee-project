import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { num } from '@/lib/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';

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
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api<Dash>(`/dashboard?period=${period}`),
  });

  const kpis = [
    { label: 'CA', value: formatMoney(data?.revenue ?? 0) },
    { label: 'Profit', value: formatMoney(data?.profit ?? 0) },
    { label: 'Ventes', value: String(data?.salesCount ?? 0) },
    { label: 'Produits vendus', value: formatQty(data?.productsSold ?? 0) },
    { label: 'Encaissé', value: formatMoney(data?.collected ?? 0) },
    { label: 'Soldes clients', value: formatMoney(data?.remainingBalances ?? 0) },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Vue d’ensemble de l’activité"
        actions={
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Aujourd’hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
          </select>
        }
      />
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{k.value}</CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Ventes et profit</CardTitle>
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
            <CardTitle>Meilleures ventes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.bestSellers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              data?.bestSellers.map((p) => (
                <div key={p.name} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">{formatQty(p.qty)}</span>
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
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <Badge variant="warning">
                    {formatQty(num(p.currentStock))} / {formatQty(num(p.minimumStock))}
                  </Badge>
                </div>
              ))
            )}
            <Link to="/stock/faible" className="text-xs text-primary">
              Voir tout
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
