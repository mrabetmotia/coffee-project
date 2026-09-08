import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { num } from '@/lib/utils';

type Product = { id: string; name: string; sku: string; currentStock: string; purchasePrice: string; image: string };

export function InventoryPage() {
  const { data } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => api<{ items: Product[] }>('/products?take=500'),
  });
  const [physical, setPhysical] = useState<Record<string, number>>({});
  const mut = useMutation({
    mutationFn: () =>
      api('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Inventaire',
          items: (data?.items ?? []).map((p) => ({
            productId: p.id,
            physicalStock: physical[p.id] ?? num(p.currentStock),
          })),
        }),
      }),
    onSuccess: () => toast.success('Inventaire enregistré'),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader
        title="Inventaire"
        subtitle="Le stock système n’est jamais modifié sans mouvement d’ajustement"
        actions={<Button onClick={() => mut.mutate()}>Valider l’inventaire</Button>}
      />
      <Table>
        <THead>
          <tr>
            <Th>Produit</Th>
            <Th>Système</Th>
            <Th>Physique</Th>
            <Th>Écart</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.items ?? []).map((p) => {
            const sys = num(p.currentStock);
            const phy = physical[p.id] ?? sys;
            return (
              <tr key={p.id}>
                <Td>
                  <img
                    src={p.image || "../images/undefined.png"}
                    alt={p.name}
                    className="mr-2 inline-block h-6 w-6 rounded-md border object-cover"
                  />
                  {p.name} <span className="text-muted-foreground">{p.sku}</span>
                </Td>
                <Td>{formatQty(sys)}</Td>
                <Td>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={phy}
                    onChange={(e) => setPhysical((s) => ({ ...s, [p.id]: Number(e.target.value) }))}
                  />
                </Td>
                <Td>{formatQty(phy - sys)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export function NewEntryPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<{ product: Product; quantity: number; unitPurchasePrice: number }[]>([]);
  const { data: results = [] } = useQuery({
    queryKey: ['search-entry', q],
    queryFn: () => api<Product[]>(`/products/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 0,
  });
  const mut = useMutation({
    mutationFn: () =>
      api('/stock-entries', {
        method: 'POST',
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            unitPurchasePrice: l.unitPurchasePrice,
          })),
        }),
      }),
    onSuccess: () => {
      toast.success('Entrée enregistrée');
      setLines([]);
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageHeader title="Nouvelle entrée stock" actions={<Button onClick={() => mut.mutate()} disabled={!lines.length}>Valider</Button>} />
      <Input placeholder="Ajouter un produit…" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.map((p) => (
        <button
          key={p.id}
          className="mt-1 block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
          onClick={() => {
            setLines((prev) => [...prev, { product: p, quantity: 1, unitPurchasePrice: num(p.purchasePrice) }]);
            setQ('');
          }}
        >
          <img
            src={p.image || "../images/undefined.png"}
            alt={p.name}
            className="mr-2 inline-block h-6 w-6 rounded-md border object-cover"
          />
          {p.name} · {p.sku}
        </button>
      ))}
      <div className="mt-4">
        <Table>
          <THead>
            <tr>
              <Th>Produit</Th>
              <Th>Quantité</Th>
              <Th>Prix d’achat</Th>
              <Th>Total</Th>
            </tr>
          </THead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={`${l.product.id}-${i}`}>
                <Td>
                  <img
                    src={l.product.image || "../images/undefined.png"}
                    alt={l.product.name}
                    className="mr-2 inline-block h-6 w-6 rounded-md border object-cover"
                  />
                  {l.product.name}</Td>
                <Td>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={l.quantity}
                    onChange={(e) =>
                      setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, quantity: Number(e.target.value) } : x)))
                    }
                  />
                </Td>
                <Td>
                  <Input
                    type="number"
                    className="h-8 w-28"
                    step={0.001}
                    value={l.unitPurchasePrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, unitPurchasePrice: Number(e.target.value) } : x)),
                      )
                    }
                  />
                </Td>
                <Td>{formatMoney(l.quantity * l.unitPurchasePrice)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export function EntriesHistoryPage() {
  const [page, setPage] = useState(0);
  const take = 12;
  const { data } = useQuery({
    queryKey: ['entries', page],
    queryFn: () =>
      api<{
        items: {
          id: string;
          number: string;
          createdAt: string;
          totalCost: string;
          items: { quantity: string; product: { name: string, image: string } }[];
        }[];
        total: number;
      }>(`/stock-entries?skip=${page * take}&take=${take}`),
  });
  return (
    <div>
      <PageHeader title="Historique des entrées" />
      <Table>
        <THead>
          <tr>
            <Th>N°</Th>
            <Th>Date</Th>
            <Th>Lignes</Th>
            <Th>Coût</Th>
          </tr>
        </THead>
        <tbody>
          {(data?.items ?? []).map((e) => (
            <tr key={e.id}>
              <Td>{e.number}</Td>
              <Td>{new Date(e.createdAt).toLocaleString('fr-TN')}</Td>
              <Td><img src={e.items[0].product.image || "../images/undefined.png"} alt={e.items[0].product.name} className="mr-2 inline-block h-6 w-6 rounded-md border object-cover" />  {e.items[0].product.name} × {formatQty(num(e.items[0].quantity))}</Td>
              <Td>{formatMoney(num(e.totalCost))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} total={data?.total ?? 0} take={take} onPageChange={(next) => setPage(next)} />
    </div>
  );
}
