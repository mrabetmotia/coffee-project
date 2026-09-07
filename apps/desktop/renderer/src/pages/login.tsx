import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(res.accessToken);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.13),transparent_28rem),radial-gradient(circle_at_85%_80%,hsl(38_90%_55%/0.11),transparent_24rem)]" />
      <Card className="relative w-full max-w-[430px] overflow-hidden border-border/80 shadow-2xl shadow-slate-950/10">
        <div className="h-1.5 bg-primary" />
        <CardHeader className="block px-7 pb-4 pt-8 sm:px-9">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25"><Coffee className="h-6 w-6" /></div>
          <p className="eyebrow mb-2">Espace de gestion</p>
          <CardTitle className="text-2xl tracking-tight">Bon retour parmi nous</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Connectez-vous à votre espace CaféStock pour piloter votre activité.</p>
        </CardHeader>
        <CardContent className="px-7 pb-8 sm:px-9">
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label className="text-xs font-semibold">Utilisateur</Label>
              <Input className="mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">Mot de passe</Label>
              <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="mt-2 h-11 w-full" disabled={loading}>
              {loading ? 'Connexion…' : 'Entrer'}
            </Button>
          </form>
          <div className="mt-7 flex items-center gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Données stockées localement et protégées</div>
        </CardContent>
      </Card>
    </div>
  );
}
