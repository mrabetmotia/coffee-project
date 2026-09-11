import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { num } from '@/lib/utils';
import { Pagination } from '@/components/ui/pagination';
import { ProductsPageSkeleton, SearchResultsSkeleton } from '@/components/ui/skeleton';

type Category = { id: string; name: string; active: boolean; _count?: { products: number } };
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  image: string | null;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  currentStock: string;
  minimumStock: string;
  active: boolean;
  category: { name: string };
  categoryId: string;
};

export function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'table' | 'card'>('table');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    image: '',
    categoryId: '',
    unit: 'pièce',
    purchasePrice: 0,
    salePrice: 0,
    minimumStock: 0,
  });
  const take = 12;
  const { data, isLoading } = useQuery({
    queryKey: ['products', q, page],
    queryFn: () =>
      api<{ items: Product[]; total: number }>(
        `/products?q=${encodeURIComponent(q)}&skip=${page * take}&take=${take}`,
      ),
  });
  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        image: form.image || undefined,
      };
      if (editingId) {
        return api(`/products/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return api('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editingId ? 'Produit mis à jour' : 'Produit créé');
      setOpen(false);
      setEditingId(null);
      setForm({
        name: '',
        sku: '',
        barcode: '',
        image: '',
        categoryId: cats[0]?.id ?? '',
        unit: 'pièce',
        purchasePrice: 0,
        salePrice: 0,
        minimumStock: 0,
      });
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <ProductsPageSkeleton />;
  }

  return (
    <div>
      <PageHeader
        title="Produits"
        actions={
          <Button
            onClick={() => {
              setEditingId(null);
              setForm((f) => ({
                ...f,
                name: '',
                sku: '',
                barcode: '',
                image: '',
                categoryId: cats[0]?.id ?? '',
                unit: 'pièce',
                purchasePrice: 0,
                salePrice: 0,
                minimumStock: 0,
              }));
              setOpen(true);
            }}
          >
            Nouveau produit
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input className="max-w-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="inline-flex rounded-lg border border-border bg-background p-1 space-x-1">
          <Button
            size="sm"
            variant={view === 'table' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => setView('table')}
          >
            Tableau
          </Button>
          <Button
            size="sm"
            variant={view === 'card' ? 'default' : 'ghost'}
            className="rounded-md"
            onClick={() => setView('card')}
          >
            Cartes
          </Button>
        </div>
      </div>

      {view === 'table' ? (
        <Table>
          <THead>
            <tr>
              <Th>Nom</Th>
              <Th>SKU</Th>
              <Th>Catégorie</Th>
              <Th>Stock</Th>
              <Th>Achat</Th>
              <Th>Vente</Th>
              <Th></Th>
            </tr>
          </THead>
          <tbody>
            {(data?.items ?? []).map((p) => (
              <tr key={p.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-10 w-10 rounded-md border object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <Link className="font-semibold text-primary hover:underline" to={`/stock/produits/${p.id}`}>
                        {p.name}
                      </Link>
                      {num(p.currentStock) <= num(p.minimumStock) ? <Badge className="ml-2" variant="destructive">Stock faible</Badge> : null}
                    </div>
                  </div>
                </Td>
                <Td>{p.sku}</Td>
                <Td>{p.category.name}</Td>
                <Td>
                  {formatQty(num(p.currentStock))} {p.unit}
                </Td>
                <Td>{formatMoney(num(p.purchasePrice))}</Td>
                <Td>{formatMoney(num(p.salePrice))}</Td>
                <Td className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingId(p.id);
                    setForm({
                      name: p.name,
                      sku: p.sku,
                      barcode: p.barcode ?? '',
                      image: p.image ?? '',
                      categoryId: p.categoryId,
                      unit: p.unit,
                      purchasePrice: Number(p.purchasePrice),
                      salePrice: Number(p.salePrice),
                      minimumStock: Number(p.minimumStock),
                    });
                    setOpen(true);
                  }}>
                    Modifier
                  </Button>
                  {p.active ? null : <Badge variant="outline">Inactif</Badge>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.items ?? []).map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => {
                setEditingId(p.id);
                setForm({
                  name: p.name,
                  sku: p.sku,
                  barcode: p.barcode ?? '',
                  image: p.image ?? '',
                  categoryId: p.categoryId,
                  unit: p.unit,
                  purchasePrice: Number(p.purchasePrice),
                  salePrice: Number(p.salePrice),
                  minimumStock: Number(p.minimumStock),
                });
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <Pagination page={page} total={data?.total ?? 0} take={take} onPageChange={(next) => setPage(next)} />
      <Modal.Root open={open} onOpenChange={setOpen}>
        <ModalContent>
          <Modal.Title className="text-lg font-semibold">{editingId ? 'Modifier le produit' : 'Nouveau produit'}</Modal.Title>
          <div className="mt-4 grid gap-3">
            <Field label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="SKU (automatique)" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} placeholder="Généré automatiquement si vide" />
            <Field label="Code-barres (automatique)" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} placeholder="Généré automatiquement si vide" />
            <Field label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} placeholder="https://..." />
            <div>
              <Label>Catégorie</Label>
              <Select value={form.categoryId} onValueChange={(categoryId) => setForm({ ...form, categoryId })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Unité" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field label="Prix d’achat (CMP initial)" value={String(form.purchasePrice)} onChange={(v) => setForm({ ...form, purchasePrice: Number(v) })} />
            <Field label="Prix de vente" value={String(form.salePrice)} onChange={(v) => setForm({ ...form, salePrice: Number(v) })} />
            <Field label="Stock minimum" value={String(form.minimumStock)} onChange={()=>{}} disabled />
            <Button onClick={() => mut.mutate()}>{editingId ? 'Mettre à jour' : 'Enregistrer'}</Button>
          </div>
        </ModalContent>
      </Modal.Root>
    </div>
  );
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const stockLow = num(product.currentStock) <= num(product.minimumStock);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-[0_8px_30px_hsl(var(--foreground)/0.04)] relative">
      {stockLow ? <Badge className="absolute top-3 right-3" variant="destructive">Faible</Badge> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-12 w-12 rounded-xl border object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <Link className="block font-semibold text-primary hover:underline" to={`/stock/produits/${product.id}`}>
              {product.name}
            </Link>
            <p className="text-xs text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        {!product.active ? <Badge variant="outline">Inactif</Badge> : null}
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Catégorie</span>
          <span className="font-medium">{product.category.name}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Stock</span>
          <span className="font-medium">
            {formatQty(num(product.currentStock))} {product.unit}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Achat</span>
          <span className="font-medium">{formatMoney(num(product.purchasePrice))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Vente</span>
          <span className="font-medium">{formatMoney(num(product.salePrice))}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>Modifier</Button>
        {stockLow ? <span className="text-xs text-red-500 dark:text-red-600">Stock minimum atteint</span> : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const { data = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const create = useMutation({
    mutationFn: () => api('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (c: Category) => api(`/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ active: !c.active }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['categories'] }),
  });
  return (
    <div>
      <PageHeader title="Catégories" />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => create.mutate()}>Ajouter</Button>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Nom</Th>
            <Th>Produits</Th>
            <Th>Statut</Th>
            <Th></Th>
          </tr>
        </THead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id}>
              <Td>{c.name}</Td>
              <Td>{c._count?.products ?? 0}</Td>
              <Td>
                <Badge variant={c.active ? 'success' : 'outline'}>{c.active ? 'Active' : 'Inactive'}</Badge>
              </Td>
              <Td className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(c)}>
                  {c.active ? 'Désactiver' : 'Activer'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>
                  Supprimer
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
