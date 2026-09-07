import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Undo2,
  Package,
  Tags,
  ArrowLeftRight,
  AlertTriangle,
  ClipboardCheck,
  PackagePlus,
  Users,
  Wallet,
  BarChart3,
  FileText,
  Settings,
  Moon,
  Sun,
  LogOut,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { setToken } from '@/lib/api';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Ventes',
    children: [
      { to: '/ventes/nouvelle', label: 'Nouvelle vente', icon: ShoppingCart },
      { to: '/ventes', label: 'Historique', icon: History },
      { to: '/ventes/retours', label: 'Retours', icon: Undo2 },
    ],
  },
  {
    label: 'Stock',
    children: [
      { to: '/stock/produits', label: 'Produits', icon: Package },
      { to: '/stock/categories', label: 'Catégories', icon: Tags },
      { to: '/stock/mouvements', label: 'Mouvements', icon: ArrowLeftRight },
      { to: '/stock/faible', label: 'Stock faible', icon: AlertTriangle },
      { to: '/stock/inventaire', label: 'Inventaire', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Entrées Stock',
    children: [
      { to: '/entrees/nouvelle', label: 'Nouvelle entrée', icon: PackagePlus },
      { to: '/entrees', label: 'Historique', icon: History },
    ],
  },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/caisse', label: 'Caisse', icon: Wallet },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
  { to: '/factures', label: 'Factures', icon: FileText },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5">
          <div className="text-lg font-semibold tracking-tight">CaféStock</div>
          <div className="text-xs text-sidebar-muted">Fournitures cafés</div>
        </div>
        <nav className="flex-1 space-y-4 overflow-auto px-3 pb-4">
          {nav.map((item) =>
            'children' in item ? (
              <div key={item.label}>
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {item.label}
                </div>
                {item.children.map((child) => (
                  <Item key={child.to} to={child.to} label={child.label} icon={child.icon} />
                ))}
              </div>
            ) : (
              <Item key={item.to} to={item.to} label={item.label} icon={item.icon} />
            ),
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="text-sm text-muted-foreground">Gestion commerciale · hors ligne</div>
          <div className="flex items-center gap-2">
            <button className="rounded-md p-2 hover:bg-accent" onClick={toggle} aria-label="Thème">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              className="rounded-md p-2 hover:bg-accent"
              onClick={() => {
                setToken(null);
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Item({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-foreground',
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
