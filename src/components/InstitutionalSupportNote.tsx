import { Link } from 'react-router-dom';

import { institutionalEmail, institutionalSupportMailto } from '../lib/institutional';

type InstitutionalSupportNoteProps = {
  className?: string;
  compact?: boolean;
};

export function InstitutionalSupportNote({
  className = '',
  compact = false,
}: InstitutionalSupportNoteProps) {
  const copy = compact
    ? 'Precisa de ajuda? Entre em contato pelo e-mail oficial'
    : 'Para suporte e dúvidas sobre a plataforma, entre em contato pelo e-mail oficial';

  return (
    <div className={`rounded-[28px] border border-slate-200/80 bg-white/92 p-5 ${className}`.trim()}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Canal oficial de suporte
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{copy}.</p>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <a
          className="inline-flex min-h-[44px] items-center rounded-2xl border border-[#0071e3]/15 bg-[#0071e3]/6 px-4 py-2 text-sm font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/10 hover:text-[#0077ed]"
          href={institutionalSupportMailto}
        >
          {institutionalEmail}
        </a>
        <Link
          className="inline-flex min-h-[44px] items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          to="/info/ajuda"
        >
          Ver ajuda e suporte
        </Link>
      </div>
    </div>
  );
}
