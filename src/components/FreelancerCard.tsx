import { Link, useLocation } from 'react-router-dom';

import type { Freelancer } from '../../shared/contracts';
import { useAppSession } from '../context/AppSessionContext';
import { currency } from '../lib/format';
import { FreelancerVerifiedSeal } from './FreelancerVerifiedSeal';
import { PriceMask } from './PriceMask';

export function FreelancerCard({ freelancer }: { freelancer: Freelancer }) {
  const location = useLocation();
  const { session } = useAppSession();
  const isBooster = freelancer.subscriptionTier === 'booster';
  const hasVerificationSeal = isBooster;
  const averagePrice = freelancer.averagePrice;
  const averagePriceVisible = averagePrice !== null;
  const canContact = session?.role === 'client';
  const contactLabel = canContact ? 'Pedir orçamento' : 'Liberar preço e contato';

  return (
    <article
      className={`glass-panel tech-panel group flex h-full flex-col rounded-[32px] p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(8,15,33,0.22)] ${
        isBooster
          ? 'border-cyan-300/45 bg-[linear-gradient(180deg,rgba(244,251,255,0.98)_0%,rgba(232,248,255,0.96)_100%)] shadow-[0_24px_80px_rgba(34,211,238,0.18)]'
          : ''
      }`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            alt={freelancer.name}
            className={`h-16 w-16 rounded-2xl object-cover ring-4 ${
              isBooster ? 'ring-cyan-300/25' : 'ring-cyan-400/10'
            }`}
            src={freelancer.avatarUrl}
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-950">{freelancer.name}</h3>
              {hasVerificationSeal ? <FreelancerVerifiedSeal variant="search" /> : null}
            </div>
            <p className="text-sm font-medium text-slate-600">{freelancer.profession}</p>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${
            isBooster
              ? 'border border-cyan-300/40 bg-cyan-500/10 text-cyan-800'
              : 'border border-slate-200 bg-slate-900 text-cyan-200'
          }`}
        >
          {freelancer.experienceLevel}
        </span>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-600">{freelancer.summary}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {freelancer.skills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isBooster
                ? 'border border-cyan-300/30 bg-cyan-400/10 text-cyan-900'
                : 'border border-cyan-400/20 bg-cyan-500/5 text-cyan-800'
            }`}
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div
          className={`rounded-3xl p-4 ${
            isBooster
              ? 'border border-cyan-200/70 bg-white/85'
              : 'border border-slate-200/80 bg-white/80'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Localização</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{freelancer.location}</p>
        </div>
        <div
          className={`rounded-3xl p-4 ${
            isBooster
              ? 'border border-cyan-200/70 bg-white/85'
              : 'border border-slate-200/80 bg-white/80'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preço médio</p>
          {averagePriceVisible ? (
            <p className="mt-1 text-sm font-semibold text-slate-700">{currency(averagePrice)}</p>
          ) : (
            <div className="mt-1">
              <PriceMask
                compact
                hint="Entre como cliente para ver o valor."
                state={{ from: location }}
                to="/login"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-3">
        <Link
          className="w-full rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          to={`/freelancers/${freelancer.slug}`}
        >
          Ver perfil completo
        </Link>
        <Link
          className="w-full rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 sm:w-auto"
          state={canContact ? undefined : { from: location }}
          to={canContact ? `/freelancers/${freelancer.slug}` : '/login'}
        >
          {contactLabel}
        </Link>
      </div>
    </article>
  );
}
