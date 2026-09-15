import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { RequireAuth, RequireRole } from '@/components/require-auth';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { NewSalePage } from '@/pages/sales-new';
import { SalesHistoryPage } from '@/pages/sales-history';
import { SaleDetailPage } from '@/pages/sale-detail';
import { ReturnsPage, MovementsPage, LowStockPage, CashPage, InvoicesPage } from '@/pages/lists';
import { ProductsPage, CategoriesPage } from '@/pages/catalog';
import { ProductDetailPage } from '@/pages/product-detail';
import { InventoryPage, NewEntryPage, EntriesHistoryPage } from '@/pages/stock-ops';
import { ClientsPage, ClientDetailPage, CreateClientPage } from '@/pages/clients';
import { AdminOrdersPage, AdminOrderDetailPage } from '@/pages/admin-orders';
import { ClientDashboardPage, ClientProductsPage, ClientProductDetailPage, ClientCartPage, ClientCheckoutPage, ClientOrdersPage, ClientOrderDetailPage, ClientProfilePage } from '@/pages/client';
import { ReportsPage } from '@/pages/reports';
import { SettingsPage } from '@/pages/settings';
import { NotificationsPage } from '@/pages/notifications';
import { getCurrentRole } from '@/lib/api';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route element={<AppLayout role="ADMIN" />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/ventes/nouvelle" element={<NewSalePage />} />
              <Route path="/ventes" element={<SalesHistoryPage />} />
              <Route path="/ventes/retours" element={<ReturnsPage />} />
              <Route path="/ventes/:id" element={<SaleDetailPage />} />
              <Route path="/stock/produits" element={<ProductsPage />} />
              <Route path="/stock/produits/:id" element={<ProductDetailPage />} />
              <Route path="/stock/categories" element={<CategoriesPage />} />
              <Route path="/stock/mouvements" element={<MovementsPage />} />
              <Route path="/stock/faible" element={<LowStockPage />} />
              <Route path="/stock/inventaire" element={<InventoryPage />} />
              <Route path="/entrees/nouvelle" element={<NewEntryPage />} />
              <Route path="/entrees" element={<EntriesHistoryPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<ClientDetailPage />} />
              <Route path="/admin/clients" element={<ClientsPage />} />
              <Route path="/admin/clients/new" element={<CreateClientPage />} />
              <Route path="/admin/clients/:id" element={<ClientDetailPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="/admin/notifications" element={<NotificationsPage />} />
              <Route path="/caisse" element={<CashPage />} />
              <Route path="/rapports" element={<ReportsPage />} />
              <Route path="/factures" element={<InvoicesPage />} />
              <Route path="/parametres" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="CLIENT" />}>
            <Route element={<AppLayout role="CLIENT" />}>
              <Route path="/client" element={<ClientDashboardPage />} />
              <Route path="/client/products" element={<ClientProductsPage />} />
              <Route path="/client/products/:id" element={<ClientProductDetailPage />} />
              <Route path="/client/cart" element={<ClientCartPage />} />
              <Route path="/client/checkout" element={<ClientCheckoutPage />} />
              <Route path="/client/orders" element={<ClientOrdersPage />} />
              <Route path="/client/orders/:id" element={<ClientOrderDetailPage />} />
              <Route path="/client/profile" element={<ClientProfilePage />} />
              <Route path="/client/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={getCurrentRole() === 'CLIENT' ? '/client' : '/'} replace />} />
      </Routes>
    </HashRouter>
  );
}
