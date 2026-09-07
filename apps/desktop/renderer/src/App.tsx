import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { RequireAuth } from '@/components/require-auth';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { NewSalePage } from '@/pages/sales-new';
import { SalesHistoryPage } from '@/pages/sales-history';
import { SaleDetailPage } from '@/pages/sale-detail';
import { ReturnsPage, MovementsPage, LowStockPage, CashPage, InvoicesPage } from '@/pages/lists';
import { ProductsPage, CategoriesPage } from '@/pages/catalog';
import { InventoryPage, NewEntryPage, EntriesHistoryPage } from '@/pages/stock-ops';
import { ClientsPage, ClientDetailPage } from '@/pages/clients';
import { ReportsPage } from '@/pages/reports';
import { SettingsPage } from '@/pages/settings';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ventes/nouvelle" element={<NewSalePage />} />
            <Route path="/ventes" element={<SalesHistoryPage />} />
            <Route path="/ventes/retours" element={<ReturnsPage />} />
            <Route path="/ventes/:id" element={<SaleDetailPage />} />
            <Route path="/stock/produits" element={<ProductsPage />} />
            <Route path="/stock/categories" element={<CategoriesPage />} />
            <Route path="/stock/mouvements" element={<MovementsPage />} />
            <Route path="/stock/faible" element={<LowStockPage />} />
            <Route path="/stock/inventaire" element={<InventoryPage />} />
            <Route path="/entrees/nouvelle" element={<NewEntryPage />} />
            <Route path="/entrees" element={<EntriesHistoryPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/caisse" element={<CashPage />} />
            <Route path="/rapports" element={<ReportsPage />} />
            <Route path="/factures" element={<InvoicesPage />} />
            <Route path="/parametres" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
