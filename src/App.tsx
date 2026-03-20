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
import { NotFoundPage } from './pages/NotFoundPage';
import { SearchPage } from './pages/SearchPage';

export default function App() {
  return (
    <AppSessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/freelancers" element={<SearchPage />} />
            <Route path="/freelancers/:slug" element={<FreelancerProfilePage />} />
            <Route path="/cadastro/cliente" element={<ClientSignupPage />} />
            <Route path="/cadastro/freelancer" element={<FreelancerSignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute role="client" />}>
              <Route path="/dashboard/cliente" element={<ClientDashboardPage />} />
            </Route>
            <Route element={<ProtectedRoute role="freelancer" />}>
              <Route path="/dashboard/freelancer" element={<FreelancerDashboardPage />} />
            </Route>
            <Route path="/info/:slug" element={<InfoPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppSessionProvider>
  );
}
