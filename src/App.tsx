import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppSessionProvider } from './context/AppSessionContext';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { ClientSignupPage } from './pages/ClientSignupPage';
import { FreelancerDashboardPage } from './pages/FreelancerDashboardPage';
import { FreelancerProfilePage } from './pages/FreelancerProfilePage';
import { FreelancerSignupPage } from './pages/FreelancerSignupPage';
import { HomePage } from './pages/HomePage';
import { InfoPage } from './pages/InfoPage';
import { LoginPage } from './pages/LoginPage';
import { MessagesPage } from './pages/MessagesPage';
import { MockFreelancerCheckoutPage } from './pages/MockFreelancerCheckoutPage';
import { MyFreelancerProfileRedirectPage } from './pages/MyFreelancerProfileRedirectPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PaymentApprovedPage } from './pages/PaymentApprovedPage';
import { PaymentExpiredPage } from './pages/PaymentExpiredPage';
import { PaymentFailedPage } from './pages/PaymentFailedPage';
import { PaymentPendingPage } from './pages/PaymentPendingPage';
import { SearchPage } from './pages/SearchPage';
import { SubscriptionPage } from './pages/SubscriptionPage';

function normalizeRouterBasename(value?: string) {
  if (!value || value === '/') {
    return undefined;
  }

  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

export default function App() {
  const routerBasename = normalizeRouterBasename(import.meta.env.VITE_APP_BASE_PATH);

  return (
    <AppSessionProvider>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/freelancers" element={<SearchPage />} />
            <Route path="/freelancers/:slug" element={<FreelancerProfilePage />} />
            <Route path="/cadastro/cliente" element={<ClientSignupPage />} />
            <Route path="/cadastro/freelancer" element={<FreelancerSignupPage />} />
            <Route path="/checkout/freelancer/:checkoutId" element={<MockFreelancerCheckoutPage />} />
            <Route path="/pagamento/aprovado" element={<PaymentApprovedPage />} />
            <Route path="/pagamento/pendente" element={<PaymentPendingPage />} />
            <Route path="/pagamento/recusado" element={<PaymentFailedPage />} />
            <Route path="/pagamento/expirado" element={<PaymentExpiredPage />} />
            <Route path="/assinatura" element={<SubscriptionPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute role="client" />}>
              <Route path="/dashboard/cliente" element={<ClientDashboardPage />} />
            </Route>
            <Route element={<ProtectedRoute role="freelancer" />}>
              <Route path="/dashboard/freelancer" element={<FreelancerDashboardPage />} />
              <Route path="/meu-perfil" element={<MyFreelancerProfileRedirectPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/mensagens" element={<MessagesPage />} />
            </Route>
            <Route path="/info/:slug" element={<InfoPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppSessionProvider>
  );
}
