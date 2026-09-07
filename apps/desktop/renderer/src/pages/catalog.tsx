import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { num } from '@/lib/utils';

type Category = { id: string; name: string; active: boolean; _count?: { products: number } };
type Product = {
  id: string;
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
  categoryId: string;
};

export function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'pièce',
    purchasePrice: 0,
    salePrice: 0,
    currentStock: 0,
    minimumStock: 0,
  });
  const { data } = useQuery({
    queryKey: ['products', q],
    queryFn: () => api<{ items: Product[] }>(`/products?q=${encodeURIComponent(q)}&take=200`),
  });
  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const mut = useMutation({
    mutationFn: () => api('/products', { method: 'POST', body: JSON.stringify({ ...form, barcode: form.barcode || undefined }) }),
    onSuccess: () => {
      toast.success('Produit créé');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Produits"
        actions={
          <Button
            onClick={() => {
              setForm((f) => ({ ...f, categoryId: cats[0]?.id ?? '' }));
              setOpen(true);
            }}
          >
            Nouveau produit
          </Button>
        }
      />
      <Input className="mb-4 max-w-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                {p.name}{' '}
                {num(p.currentStock) <= num(p.minimumStock) ? <Badge variant="warning">Stock faible</Badge> : null}
              </Td>
              <Td>{p.sku}</Td>
              <Td>{p.category.name}</Td>
              <Td>
                {formatQty(num(p.currentStock))} {p.unit}
              </Td>
              <Td>{formatMoney(num(p.purchasePrice))}</Td>
              <Td>{formatMoney(num(p.salePrice))}</Td>
              <Td>{p.active ? null : <Badge variant="outline">Inactif</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Modal.Root open={open} onOpenChange={setOpen}>
        <ModalContent>
          <Modal.Title className="text-lg font-semibold">Nouveau produit</Modal.Title>
          <div className="mt-4 grid gap-3">
            <Field label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
            <Field label="Code-barres" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
            <div>
              <Label>Catégorie</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Unité" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field label="Prix d’achat (CMP initial)" value={String(form.purchasePrice)} onChange={(v) => setForm({ ...form, purchasePrice: Number(v) })} />
            <Field label="Prix de vente" value={String(form.salePrice)} onChange={(v) => setForm({ ...form, salePrice: Number(v) })} />
            <Field label="Stock initial" value={String(form.currentStock)} onChange={(v) => setForm({ ...form, currentStock: Number(v) })} />
            <Field label="Stock minimum" value={String(form.minimumStock)} onChange={(v) => setForm({ ...form, minimumStock: Number(v) })} />
            <Button onClick={() => mut.mutate()}>Enregistrer</Button>
          </div>
        </ModalContent>
      </Modal.Root>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
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
