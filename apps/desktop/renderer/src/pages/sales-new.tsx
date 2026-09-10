import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader, formatMoney, formatQty } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { num } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Barcode, Check, Search, Trash2 } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  image: string;
  sku: string;
  barcode: string | null;
  salePrice: string;
  currentStock: string;
  unit: string;
};

type CartLine = { product: Product; quantity: number; unitPrice: number };

type Client = { id: string; name: string };

export function NewSalePage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientId, setClientId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState('CASH');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const { data: results = [] } = useQuery({
    queryKey: ['product-search', debounced],
    queryFn: () => api<Product[]>(`/products/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length > 0,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<Client[]>('/clients'),
  });

  function addProduct(p: Product, qty = 1) {
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + qty } : l));
      }
      return [...prev, { product: p, quantity: qty, unitPrice: num(p.salePrice) }];
    });
    setQ('');
    searchRef.current?.focus();
  }

  async function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && q.trim()) {
      e.preventDefault();
      const exact = await api<Product[]>(`/products/search?q=${encodeURIComponent(q.trim())}`);
      const byBarcode = exact.find((p) => p.barcode === q.trim()) ?? exact[0];
      if (byBarcode) addProduct(byBarcode);
    }
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = Math.max(0, subtotal - discount);
  const remaining = Math.max(0, total - paid);

  const mutation = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId || undefined,
          discountAmount: discount,
          paidAmount: paid,
          paymentMethod: method,
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: l.unitPrice })),
        }),
      }),
    onSuccess: (sale) => {
      toast.success('Vente enregistrée');
      navigate(`/ventes/${sale.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = cart.length > 0 && !mutation.isPending;
  console.log("results", results)
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <PageHeader title="Nouvelle vente" subtitle="Recherche, douchette, validation rapide" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            className="h-12 pl-10 pr-12"
            placeholder="Nom, SKU ou code-barres…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <Barcode className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        </div>
        {results.length > 0 && q ? (
          <Card className="mt-2 overflow-hidden">
            <CardContent className="p-0">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center justify-between gap-4 border-b border-border/70 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-accent"
                  onClick={() => addProduct(p)}
                >
                  <span className="min-w-0 truncate font-medium flex items-center gap-2">
                    <img
                      src={p?.image || "../images/undefined.png"}
                      alt={p.name}
                      className="h-10 w-10 rounded-md border object-cover"
                    />
                    {p.name} <span className="font-normal text-muted-foreground">· {p.sku}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatMoney(num(p.salePrice))} · stock {formatQty(num(p.currentStock))}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
        <div className="mt-5 overflow-auto rounded-xl border border-border/80 bg-card shadow-[0_8px_30px_hsl(var(--foreground)/0.04)]">
          <table className="w-full text-sm">
            <thead className="bg-muted/55 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Produit</th>
                <th className="px-4 py-3 text-center">Qté</th>
                <th className="px-4 py-3 text-center">P.U.</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    <Barcode className="mx-auto mb-3 h-8 w-8 text-primary/50" />
                    <p className="font-medium text-foreground">Votre panier est vide</p>
                    <p className="mt-1 text-sm">Scannez ou recherchez un produit pour commencer.</p>
                  </td>
                </tr>
              ) : (
                cart.map((l) => (
                  <tr key={l.product.id} className="border-t border-border/70 transition-colors hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-4 py-3 font-medium">{l.product.name}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        className="h-8 w-20 mx-auto text-center"
                        min={0}
                        step={1}
                        value={l.quantity}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((x) =>
                              x.product.id === l.product.id ? { ...x, quantity: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      <label>
                        {formatMoney(l.unitPrice)}
                      </label>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{formatMoney(l.quantity * l.unitPrice)}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" aria-label="Retirer le produit" onClick={() => setCart((p) => p.filter((x) => x.product.id !== l.product.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Card className="h-fit xl:sticky xl:top-6">
        <CardContent className="space-y-4 p-5">
          <div className="border-b border-border/70 pb-4"><p className="eyebrow mb-1">Récapitulatif</p><p className="text-lg font-semibold tracking-tight">Finaliser la vente</p></div>
          <div>
            <div className="text-sm font-medium">Client</div>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Vente comptoir</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Row label="Sous-total" value={formatMoney(subtotal)} />
          <div>
            <div className="text-sm font-medium">Remise</div>
            <Input type="number" step={0.001} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="rounded-xl bg-accent/60 px-4 py-3"><Row label="Total" value={formatMoney(total)} strong /></div>
          <div>
            <div className="text-sm">Paiement</div>
            <select
              className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="CASH">Espèces</option>
              <option value="CHECK">Chèque</option>
              <option value="TRANSFER">Virement</option>
              <option value="OTHER">Autre</option>
            </select>
          </div>
          <div>
            <div className="text-sm font-medium">Montant payé</div>
            <Input type="number" step={0.001} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setPaid(total)}>
              <Check className="h-3.5 w-3.5" /> Payer le total
            </Button>
          </div>
          <Row label="Reste" value={formatMoney(remaining)} />
          <Button className="w-full" disabled={!canSubmit} onClick={() => mutation.mutate()}>
            Valider la vente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-semibold' : ''}>{value}</span>
    </div>
  );
}

