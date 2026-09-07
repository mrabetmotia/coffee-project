import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Settings = {
  companyName: string;
  companyPhone: string | null;
  companyAddress: string | null;
  currency: string;
  openingBalance: string;
  autoBackup: boolean;
  invoiceFooter: string | null;
};

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });
  const [form, setForm] = useState<Partial<Settings>>({});
  const merged = { ...data, ...form };
  const save = useMutation({
    mutationFn: () =>
      api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          companyName: merged.companyName,
          companyPhone: merged.companyPhone,
          companyAddress: merged.companyAddress,
          currency: merged.currency,
          openingBalance: Number(merged.openingBalance),
          autoBackup: merged.autoBackup,
          invoiceFooter: merged.invoiceFooter,
        }),
      }),
    onSuccess: () => {
      toast.success('Paramètres enregistrés');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const backup = useMutation({
    mutationFn: () => api<{ path: string }>('/backup', { method: 'POST' }),
    onSuccess: (r) => toast.success(`Sauvegarde : ${r.path}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: backups = [] } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api<{ name: string; path: string; createdAt: string }[]>('/backup'),
  });
  const restore = useMutation({
    mutationFn: (path: string) => api('/backup/restore', { method: 'POST', body: JSON.stringify({ path }) }),
    onSuccess: () => toast.success('Restauration effectuée. Relancez l’application.'),
    onError: (e: Error) => toast.error(e.message),
  });

  async function pickRestore() {
    const path = await window.cafestock?.pickBackup();
    if (!path) return;
    if (!confirm('Restaurer cette sauvegarde ? Une copie de sécurité de la base actuelle sera créée.')) return;
    restore.mutate(path);
  }

  const pwd = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api('/auth/password', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => toast.success('Mot de passe modifié'),
    onError: (e: Error) => toast.error(e.message),
  });
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Paramètres" />
      <Card>
        <CardHeader>
          <CardTitle>Entreprise</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div>
            <Label>Nom</Label>
            <Input value={merged.companyName ?? ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={merged.companyPhone ?? ''} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={merged.companyAddress ?? ''} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
          </div>
          <div>
            <Label>Devise</Label>
            <Input value={merged.currency ?? 'DT'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div>
            <Label>Solde d’ouverture caisse</Label>
            <Input
              type="number"
              value={String(merged.openingBalance ?? 0)}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(merged.autoBackup)}
              onChange={(e) => setForm({ ...form, autoBackup: e.target.checked })}
            />
            Sauvegarde automatique
          </label>
          <Button onClick={() => save.mutate()}>Enregistrer</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde / Restauration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => backup.mutate()}>Sauvegarder maintenant</Button>
          <Button variant="outline" onClick={() => void pickRestore()}>
            Restaurer un fichier…
          </Button>
          <ul className="text-sm text-muted-foreground">
            {backups.map((b) => (
              <li key={b.path}>
                {b.name} · {new Date(b.createdAt).toLocaleString('fr-TN')}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe administrateur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Actuel" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          <Input type="password" placeholder="Nouveau" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          <Button onClick={() => pwd.mutate({ currentPassword, newPassword })}>Changer</Button>
        </CardContent>
      </Card>
    </div>
  );
}
