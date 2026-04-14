import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';

export function MyFreelancerProfileRedirectPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function resolveProfileRoute() {
      try {
        const dashboard = await api.getFreelancerDashboard({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          navigate(`/freelancers/${dashboard.profile.slug}`, { replace: true });
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível abrir seu perfil público.',
          );
        }
      }
    }

    void resolveProfileRoute();

    return () => controller.abort();
  }, [navigate]);

  if (error) {
    return (
      <div className="container py-14">
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-14">
      <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
        Abrindo seu perfil público...
      </div>
    </div>
  );
}
