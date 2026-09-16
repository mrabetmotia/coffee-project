import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  Menu,
  Store,
  ArrowLeft,
  List,
  UserRound,
  ClipboardList,
  Bell,
  MessageSquareText,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { api, getCurrentUser, setCurrentUser, setToken } from '@/lib/api';
import { getChatSocket, refreshChatSocketAuth } from '@/lib/chat';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { NotificationCenter } from '@/components/notification-center';
import { useCart } from '@/lib/cart';

const adminNav = [
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
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/orders', label: 'Commandes clients', icon: ClipboardList },
  { to: '/admin/chat', label: 'Messages', icon: MessageSquareText },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/caisse', label: 'Caisse', icon: Wallet },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
  { to: '/factures', label: 'Factures', icon: FileText },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

const clientNav = [
  { to: '/client', label: 'Accueil', icon: LayoutDashboard },
  { to: '/client/products', label: 'Produits', icon: Package },
  { to: '/client/cart', label: 'Panier', icon: ShoppingCart },
  { to: '/client/orders', label: 'Mes commandes', icon: List },
  { to: '/client/chat', label: 'Messages', icon: MessageSquareText },
  { to: '/client/notifications', label: 'Notifications', icon: Bell },
  { to: '/client/profile', label: 'Profil', icon: UserRound },
];

export function AppLayout({ role = 'ADMIN' }: { role?: 'ADMIN' | 'CLIENT' }) {
  const { theme, toggle } = useTheme();
  const { language, setLanguage, t, languageNames } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { cart } = useCart();
  const productCount = Object.keys(cart).length;
  const nav = role === 'CLIENT' ? clientNav : adminNav;
  const currentLabel = nav
    .flatMap((item) => ('children' in item ? item.children : [item]))
    .find((item) => item?.to === location.pathname)?.label ?? 'Espace de travail';
  const closeMobile = () => setMobileOpen(false);
  const closeSidebar = () => {
    setMobileOpen(false);
    setDesktopOpen(false);
  };
  const openSidebar = () => {
    setMobileOpen(true);
    setDesktopOpen(true);
  };

  useEffect(() => {
    let active = true;
    const socket = getChatSocket();
    const onUnreadCount = (payload: { count?: number }) => {
      if (active) setUnreadMessages(Math.max(0, payload.count ?? 0));
    };
    const onChatConnection = (payload: { status: 'connected' | 'unauthorized' }) => {
      (socket as typeof socket & { cafestockAuthenticated?: boolean }).cafestockAuthenticated = payload.status === 'connected';
    };
    const onDisconnect = () => {
      (socket as typeof socket & { cafestockAuthenticated?: boolean }).cafestockAuthenticated = false;
    };

    refreshChatSocketAuth();
    void api<{ count: number }>('/chat/unread-count').then((payload) => {
      if (active) setUnreadMessages(Math.max(0, payload.count));
    }).catch(() => undefined);
    socket.on('chat:unread-count', onUnreadCount).on('chat:connection', onChatConnection).on('disconnect', onDisconnect);
    if (!socket.connected) socket.connect();

    return () => {
      active = false;
      socket.off('chat:unread-count', onUnreadCount).off('chat:connection', onChatConnection).off('disconnect', onDisconnect);
    };
  }, []);

  function logout() {
    setToken(null);
    setCurrentUser(null);
    navigate('/login');
  }

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-background">
      {mobileOpen ? <button aria-label="Fermer le menu" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={closeMobile} /> : null}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 -translate-x-full flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-all lg:relative lg:w-64 lg:translate-x-0 lg:shadow-none',
        mobileOpen && 'translate-x-0',
        !desktopOpen && 'lg:w-0 lg:-translate-x-full lg:overflow-hidden',
      )}>
        <div className="flex items-center justify-between px-6 pb-7 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Store className="h-5 w-5" /></div>
            <div>
              <div className="text-[17px] font-semibold tracking-tight">CaféStock</div>
              <div className="text-[11px] text-sidebar-muted">{t('Fournitures cafés')}</div>
            </div>
          </div>
          <button className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={closeSidebar} aria-label="Fermer le menu"><LogOut className="h-4 w-4 rotate-180" /></button>
        </div>
        <nav className="flex-1 space-y-2 overflow-auto px-4 pb-4">
          {nav.map((item) =>
            'children' in item ? (
              <div key={item.label} className='pb-3'>
                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {t(item.label)}
                </div>
                {item?.children?.map((child) => (
                  <Item key={child.to} to={child.to} label={t(child.label)} icon={child.icon} onClick={closeMobile} end />
                ))}
              </div>
            ) : (
              <Item key={`${item.to}-${item.to === '/client/cart' ? productCount : item.to.includes('/chat') ? unreadMessages : 0}`} to={item.to} label={t(item.label)} icon={item.icon} onClick={closeMobile} badge={item.to.includes('/chat') && unreadMessages > 0 ? unreadMessages : item.to === '/client/cart' && productCount > 0 ? productCount : undefined} />
            ),
          )}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">{(getCurrentUser()?.name ?? (role === 'CLIENT' ? 'CL' : 'AD')).slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{role === 'CLIENT' ? (getCurrentUser()?.name ?? 'Client') : 'Administrateur'}</p><p className="truncate text-[11px] text-sidebar-muted">{role === 'CLIENT' ? 'Compte client' : 'Compte local'}</p></div>
            <button onClick={logout} className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label={t('Se déconnecter')}><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between border-b border-border/70 bg-card/75 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-2">
            {!desktopOpen && <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={openSidebar} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>}
            <button
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => navigate(-1)}
              aria-label={t('Retour')}
              title={t('Retour')}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div><p className="text-sm font-semibold">{t(currentLabel)}</p><p className="hidden text-xs text-muted-foreground sm:block">{t('Gestion commerciale')}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="Language" value={language} onChange={(event) => setLanguage(event.target.value as 'fr' | 'en' | 'ar' | 'de' | 'it' | 'tr')} className="h-9 w-[58px] rounded-lg border border-input bg-card px-2 text-xs font-semibold">
              <option value="fr">{languageNames.fr}</option>
              <option value="en">{languageNames.en}</option>
              <option value="ar">{languageNames.ar}</option>
              <option value="de">{languageNames.de}</option>
              <option value="it">{languageNames.it}</option>
              <option value="tr">{languageNames.tr}</option>
            </select>
            <NotificationCenter />
            <button className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" onClick={toggle} aria-label="Thème">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden" onClick={logout} aria-label="Se déconnecter"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1600px]"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

function Item({
  to,
  label,
  icon: Icon,
  onClick,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  onClick: () => void;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end ?? to === '/'}
      className={({ isActive }) =>
        cn(
          'mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-foreground shadow-sm',
        )
      }
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{badge}</span> : null}
    </NavLink>
  );
}
