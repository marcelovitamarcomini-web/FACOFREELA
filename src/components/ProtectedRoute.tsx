import { Navigate, Outlet, useLocation } from 'react-router-dom';

import type { UserRole } from '../../shared/contracts';
import { useAppSession } from '../context/AppSessionContext';

interface ProtectedRouteProps {
  role: UserRole;
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const location = useLocation();
  const { loading, session } = useAppSession();

  if (loading) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Validando sua sessão...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (session.role !== role) {
    return (
      <Navigate
        replace
        to={session.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente'}
      />
    );
  }

  return <Outlet />;
}
