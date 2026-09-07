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

type Product = {
  id: string;
  name: string;
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
      api('/sales', {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId || undefined,
          discountAmount: discount,
          paidAmount: paid,
          paymentMethod: method,
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, unitPrice: l.unitPrice })),
        }),
      }),
    onSuccess: (sale: { id: string }) => {
      toast.success('Vente enregistrée');
      navigate(`/ventes/${sale.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = cart.length > 0 && !mutation.isPending;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div>
        <PageHeader title="Nouvelle vente" subtitle="Recherche, douchette, validation rapide" />
        <Input
          ref={searchRef}
          placeholder="Nom, SKU ou code-barres…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKey}
        />
        {results.length > 0 && q ? (
          <Card className="mt-2">
            <CardContent className="p-0">
              {results.map((p) => (
                <button
                  key={p.id}
                  className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                  onClick={() => addProduct(p)}
                >
                  <span>
                    {p.name} <span className="text-muted-foreground">· {p.sku}</span>
                  </span>
                  <span>
                    {formatMoney(num(p.salePrice))} · stock {formatQty(num(p.currentStock))}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
        <div className="mt-4 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2">Qté</th>
                <th className="px-3 py-2">P.U.</th>
                <th className="px-3 py-2">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Aucun article. Scannez ou recherchez un produit.
                  </td>
                </tr>
              ) : (
                cart.map((l) => (
                  <tr key={l.product.id} className="border-t">
                    <td className="px-3 py-2">{l.product.name}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        className="h-8 w-20"
                        min={0.001}
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
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        className="h-8 w-24"
                        step={0.001}
                        value={l.unitPrice}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((x) =>
                              x.product.id === l.product.id ? { ...x, unitPrice: Number(e.target.value) } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{formatMoney(l.quantity * l.unitPrice)}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" onClick={() => setCart((p) => p.filter((x) => x.product.id !== l.product.id))}>
                        Retirer
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-3 p-5">
          <div>
            <div className="text-sm font-medium">Client</div>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
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
            <div className="text-sm">Remise</div>
            <Input type="number" step={0.001} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <Row label="Total" value={formatMoney(total)} strong />
          <div>
            <div className="text-sm">Paiement</div>
            <select
              className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
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
            <div className="text-sm">Montant payé</div>
            <Input type="number" step={0.001} value={paid} onChange={(e) => setPaid(Number(e.target.value))} />
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setPaid(total)}>
              Payer le total
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

