import { Link } from 'react-router-dom';

import type { Freelancer } from '../../shared/contracts';
import { FreelancerVerifiedSeal } from './FreelancerVerifiedSeal';

export function FreelancerCard({ freelancer }: { freelancer: Freelancer }) {
  const isBooster = freelancer.subscriptionTier === 'booster';
  const hasVerificationSeal = isBooster;

  return (
    <article
      className={`glass-panel tech-panel group flex h-full flex-col rounded-[30px] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(15,23,42,0.1)] ${
        isBooster
          ? 'border-[#0071e3]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,248,255,0.98)_100%)] shadow-[0_16px_40px_rgba(0,113,227,0.08)]'
          : ''
      }`}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <img
            alt={freelancer.name}
            className={`h-14 w-14 rounded-[18px] object-cover ring-4 sm:h-16 sm:w-16 sm:rounded-[20px] ${
              isBooster ? 'ring-[#0071e3]/16' : 'ring-slate-200'
            }`}
            src={freelancer.avatarUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-bold text-slate-950 sm:text-lg">{freelancer.name}</h3>
              {hasVerificationSeal ? <FreelancerVerifiedSeal variant="search" /> : null}
            </div>
            <p className="text-sm font-medium text-slate-600">{freelancer.profession}</p>
          </div>
        </div>

        <span
          className={`self-start rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            isBooster
              ? 'border border-[#0071e3]/18 bg-[#0071e3]/6 text-[#0071e3]'
              : 'border border-slate-200 bg-white text-slate-600'
          }`}
        >
          {freelancer.category}
        </span>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-600">{freelancer.summary}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {freelancer.skills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isBooster
                ? 'border border-[#0071e3]/15 bg-[#0071e3]/5 text-[#0071e3]'
                : 'border border-slate-200 bg-slate-50 text-slate-700'
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
              ? 'border border-[#0071e3]/12 bg-white/90'
              : 'border border-slate-200/80 bg-white/80'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Localização</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{freelancer.location}</p>
        </div>
        <div
          className={`rounded-3xl p-4 ${
            isBooster
              ? 'border border-[#0071e3]/12 bg-white/90'
              : 'border border-slate-200/80 bg-white/80'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Disponibilidade</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{freelancer.availability}</p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#0071e3] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#0077ed] sm:w-auto"
          to={`/freelancers/${freelancer.slug}`}
        >
          Ver perfil completo
        </Link>
        <Link
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-[#0071e3]/30 hover:text-[#0071e3] sm:w-auto"
          to={`/freelancers/${freelancer.slug}`}
        >
          Ver contato externo
        </Link>
      </div>
    </article>
  );
}
