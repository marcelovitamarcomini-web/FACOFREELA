import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { ClientDashboard } from '../../shared/contracts';
import { FreelancerCard } from '../components/FreelancerCard';
import { api } from '../lib/api';

export function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const data = await api.getClientDashboard({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDashboard(data);
          setError(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível carregar o dashboard.',
          );
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="container py-14">
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando dashboard do cliente...
        </div>
      </div>
    );
  }

  return (
    <div className="container space-y-8 py-10 sm:space-y-10 sm:py-12 lg:py-14">
      <section className="glass-panel rounded-[36px] p-5 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
              Dashboard do cliente
            </p>
            <h1 className="mt-4 text-[2.2rem] font-extrabold leading-[1.02] tracking-tight text-slate-950 sm:text-[2.8rem]">
              {dashboard.profile.name}, compare perfis e siga pelo contato externo quando fizer sentido.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              O painel agora serve para organizar sua busca e decidir melhor antes de falar com um
              profissional. O primeiro contato acontece fora do site, direto no canal publicado em
              cada perfil.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:w-auto sm:min-w-[15rem]">
            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700">Perfis salvos</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">
                {dashboard.favorites.length}
              </p>
            </div>
            <Link
              className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              to="/freelancers"
            >
              Explorar profissionais
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
        <article className="glass-panel rounded-[32px] p-7 shadow-soft">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Perfis em destaque
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Profissionais para você avaliar com calma
              </h2>
            </div>
            <Link className="text-sm font-semibold text-brand-600" to="/freelancers">
              Ver busca completa
            </Link>
          </div>

          <div className="mt-6 grid gap-6">
            {dashboard.favorites.map((freelancer) => (
              <FreelancerCard key={freelancer.id} freelancer={freelancer} />
            ))}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] bg-slate-950 p-7 text-white shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Como avançar
            </p>
            <h2 className="mt-2 text-2xl font-bold">Use o perfil como filtro antes do contato</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li>Compare resumo, área atendida, disponibilidade e portfólio antes de chamar.</li>
              <li>Abra o perfil e siga para WhatsApp, site ou LinkedIn quando fizer sentido.</li>
              <li>Use sua conta para voltar aos perfis certos sem perder o contexto da busca.</li>
            </ul>
          </article>

          <article className="rounded-[32px] border border-brand-100 bg-brand-50 p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">
              Operação leve
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li>O primeiro contato acontece fora da plataforma para reduzir peso no banco.</li>
              <li>WhatsApp, site e LinkedIn aparecem no perfil quando o profissional publicar.</li>
              <li>O painel continua útil para organizar a busca e voltar nos perfis certos.</li>
            </ul>
          </article>

          <article className="glass-panel rounded-[32px] p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Avisos da conta
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              {dashboard.notifications.map((notification) => (
                <li
                  key={notification}
                  className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4"
                >
                  {notification}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
