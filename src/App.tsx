import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CrmProvider } from './context/CrmContext';
import { useAuth } from './hooks/useAuth';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProspectsPage } from './pages/ProspectsPage';
import { ProspectDetailPage } from './pages/ProspectDetailPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { AgendaPage } from './pages/AgendaPage';
import { PipelinePage } from './pages/PipelinePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { QuotesPage } from './pages/QuotesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ComplaintsPage } from './pages/ComplaintsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F8] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-[#C9A125] border-t-[#19283E] rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#19283E]/75 font-medium">Chargement de Arena Group CRM...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/prospects" element={<ProspectsPage />} />
        <Route path="/prospects/:id" element={<ProspectDetailPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/contacts/:id" element={<ContactDetailPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/companies/:id" element={<CompanyDetailPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/actions" element={<Navigate to="/agenda" replace />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <HashRouter>
      <CrmProvider>
        <AppRoutes />
      </CrmProvider>
    </HashRouter>
  );
}
