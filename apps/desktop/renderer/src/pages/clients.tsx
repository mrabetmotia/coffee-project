import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Search, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, formatMoney } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, THead, Th, Td } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { num } from '@/lib/utils';
import { ClientDetailSkeleton, TableSkeleton } from '@/components/ui/skeleton';

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  salesCount: number;
  totalPurchases: number;
  remainingBalance: number;
  paid: number;
  _count?: { orders: number };
};

export function ClientsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-clients', query],
    queryFn: () => api<Client[]>(`/admin/clients${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api(`/admin/clients/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
    onSuccess: () => {
      toast.success('Statut du client mis à jour');
      void qc.invalidateQueries({ queryKey: ['admin-clients'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = data.filter((client) => status === 'all' || (status === 'active' ? client.isActive : !client.isActive));
  return (
    <div className="space-y-6">
      <PageHeader title="Clients" subtitle="Gérez les comptes et l’accès au portail client." actions={<Link to="/admin/clients/new"><Button><UserPlus className="h-4 w-4" />Ajouter un client</Button></Link>} />
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="client-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par nom, email ou téléphone" /></div>
        <div className="flex gap-2"><Button size="sm" variant={status === 'all' ? 'default' : 'outline'} onClick={() => setStatus('all')}>Tous</Button><Button size="sm" variant={status === 'active' ? 'default' : 'outline'} onClick={() => setStatus('active')}>Actifs</Button><Button size="sm" variant={status === 'inactive' ? 'default' : 'outline'} onClick={() => setStatus('inactive')}>Inactifs</Button></div>
      </section>
      {isLoading ? <TableSkeleton /> :
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <THead>
            <tr>
              <Th>Nom</Th>
              <Th>Email</Th>
              <Th>Téléphone</Th>
              <Th>Commandes</Th>
              <Th>Statut</Th>
              <Th>Créé le</Th>
              <Th>Actions</Th>
            </tr>
          </THead>
          <tbody>
            {!isLoading && filtered.length === 0 ? <tr><Td colSpan={6}><div className="py-8 text-center text-sm text-muted-foreground">Aucun client trouvé.</div></Td></tr> : null}
            {filtered.map((c) => (
              <tr key={c.id}>
                <Td>
                  <Link className="text-primary" to={`/admin/clients/${c.id}`}>
                    {c.name}
                  </Link>
                </Td>
                <Td>{c.email ?? '—'}</Td>
                <Td>{c.phone ?? '—'}</Td>
                <Td>{c._count?.orders ?? 0}</Td>
                <Td><Badge variant={c.isActive ? 'default' : 'outline'}>{c.isActive ? 'Actif' : 'Inactif'}</Badge></Td>
                <Td>{new Date(c.createdAt).toLocaleDateString('fr-FR')}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Link to={`/admin/clients/${c.id}`}><Button size="sm" variant="outline">Voir</Button></Link>
                    <Button size="sm" variant="ghost" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: c.id, isActive: !c.isActive })}>{c.isActive ? 'Désactiver' : 'Activer'}</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      }
    </div>
  );
}

export function CreateClientPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const mutation = useMutation({
    mutationFn: () => api('/admin/clients', {
      method: 'POST',
      body: JSON.stringify({ name: form.name.trim(), username: form.email.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || undefined, address: form.address.trim() || undefined }),
    }),
    onSuccess: () => {
      toast.success('Client créé avec succès');
      navigate('/admin/clients');
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(err.message);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Le nom est obligatoire.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Saisissez une adresse email valide.');
    if (!form.password) return setError('Le mot de passe est obligatoire.');
    if (form.password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.');
    if (form.password !== form.confirmPassword) return setError('Les mots de passe ne correspondent pas.');
    mutation.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajouter un client" subtitle="Créez un compte client qui pourra se connecter avec son email." />
      <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <div><Label htmlFor="client-email">Email <span className="text-destructive">*</span></Label><Input id="client-email" type="email" required autoComplete="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label htmlFor="client-password">Mot de passe <span className="text-destructive">*</span></Label><div className="relative mt-1"><Input id="client-password" type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="new-password" className="pr-10" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((value) => !value)} aria-label="Afficher le mot de passe">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          <div><Label htmlFor="client-confirm-password">Confirmer le mot de passe <span className="text-destructive">*</span></Label><div className="relative mt-1"><Input id="client-confirm-password" type={showConfirmation ? 'text' : 'password'} required minLength={6} autoComplete="new-password" className="pr-10" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /><button type="button" className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmation((value) => !value)} aria-label="Afficher la confirmation">{showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          <Field label="Téléphone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
          <Field label="Adresse" value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
        </div>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Link to="/admin/clients"><Button type="button" variant="outline">Annuler</Button></Link>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Création…' : 'Créer le client'}</Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (value: string) => void }) {
  const id = `client-${label.toLowerCase().replaceAll(' ', '-')}`;
  return <div><Label htmlFor={id}>{label}{required ? <span className="text-destructive"> *</span> : null}</Label><Input id={id} required={required} className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

export function ClientDetailPage() {
  const { id } = useParams();
  const { data } = useQuery({
    queryKey: ['client', id],
    queryFn: () =>
      api<{
        name: string;
        phone: string | null;
        address: string | null;
        salesCount: number;
        totalPurchases: number;
        remainingBalance: number;
        paid: number;
        sales: { id: string; invoiceNumber: string; total: string; remainingAmount: string; createdAt: string }[];
      }>(`/admin/clients/${id}`),
  });
  if (!data) {
    return <ClientDetailSkeleton />;
  }

  return (
    <div>
      <PageHeader title={data.name} subtitle={data.phone ?? ''} />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <Stat label="Ventes" value={String(data.salesCount)} />
        <Stat label="Achats" value={formatMoney(data.totalPurchases)} />
        <Stat label="Payé" value={formatMoney(data.paid)} />
        <Stat label="Solde" value={formatMoney(data.remainingBalance)} />
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Facture</Th>
            <Th>Date</Th>
            <Th>Total</Th>
            <Th>Reste</Th>
          </tr>
        </THead>
        <tbody>
          {data.sales.map((s) => (
            <tr key={s.id}>
              <Td>
                <Link className="text-primary" to={`/ventes/${s.id}`}>
                  {s.invoiceNumber}
                </Link>
              </Td>
              <Td>{new Date(s.createdAt).toLocaleString('fr-TN')}</Td>
              <Td>{formatMoney(num(s.total))}</Td>
              <Td>{formatMoney(num(s.remainingAmount))}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
