import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ArrowUpRight, Barcode, CalendarDays, Package, Tag } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { num } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

type Product = {
  id: string;
  image: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  currentStock: string;
  minimumStock: string;
  active: boolean;
  category: { name: string };
  createdAt: string;
  updatedAt: string;
};

export function ProductDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api<Product>(`/products/${id}`),
    enabled: Boolean(id),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('Chargement du produit…')}</p>;
  if (isError || !data) return <p className="text-sm text-destructive">{t('Impossible de charger ce produit.')}</p>;

  const lowStock = num(data.currentStock) <= num(data.minimumStock);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        subtitle={`${data.category.name} · ${data.sku}`}
        actions={<Badge variant={data.active ? 'success' : 'outline'}>{t(data.active ? 'Actif' : 'Inactif')}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Package} label={t('Stock actuel')} value={`${formatQty(num(data.currentStock))} ${data.unit}`} tone={lowStock ? 'warning' : 'default'} />
        <Metric icon={Package} label={t('Stock minimum')} value={`${formatQty(num(data.minimumStock))} ${data.unit}`} />
        <Metric icon={Tag} label={t('Prix de vente')} value={formatMoney(num(data.salePrice))} />
        <Metric icon={ArrowUpRight} label={t('Prix d’achat')} value={formatMoney(num(data.purchasePrice))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div><p className="eyebrow mb-1">{t('Informations produit')}</p><CardTitle>{t('Détails et références')}</CardTitle></div>
          </CardHeader>
          <img
            src={data.image || "../images/undefined.png"}
            alt={data.name}
            className="m-5 mt-2 h-32 w-32 rounded-md border object-cover"
          />
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Detail label={t('Nom du produit')} value={data.name} />
            <Detail label={t('Catégorie')} value={data.category.name} />
            <Detail label="SKU" value={data.sku} />
            <Detail label={t('Code-barres')} value={data.barcode ?? t('Non renseigné')} icon={<Barcode className="h-4 w-4" />} />
            <Detail label={t('Unité de vente')} value={data.unit} />
            <Detail label={t('Statut')} value={t(data.active ? 'Produit actif' : 'Produit inactif')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div><p className="eyebrow mb-1">{t('Suivi')}</p><CardTitle>{t('Dates importantes')}</CardTitle></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateDetail label={t('Créé le')} value={data.createdAt} />
            <DateDetail label={t('Dernière mise à jour')} value={data.updatedAt} />
            <div className="rounded-xl bg-accent/60 p-4">
              <p className="text-sm font-semibold">{t(lowStock ? 'Stock à surveiller' : 'Stock disponible')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t(lowStock ? 'Le stock actuel est inférieur ou égal au seuil minimum.' : 'Le stock actuel est supérieur au seuil minimum.')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = 'default' }: { icon: typeof Package; label: string; value: string; tone?: 'default' | 'warning' }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <div className={tone === 'warning' ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary'}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-lg font-semibold tracking-tight">{value}</p></div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 flex items-center gap-2 break-words text-sm font-semibold">{icon}{value}</p></div>;
}

function DateDetail({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{new Date(value).toLocaleString('fr-TN')}</p></div></div>;
}
