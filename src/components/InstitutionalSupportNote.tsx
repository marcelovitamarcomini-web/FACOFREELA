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
    : 'Para suporte e d?vidas sobre a plataforma, entre em contato pelo e-mail oficial';

  return (
    <div className={`rounded-[28px] border border-slate-200/80 bg-white/92 p-5 ${className}`.trim()}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Canal oficial de suporte
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {copy}{' '}
        <a
          className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]"
          href={institutionalSupportMailto}
        >
          {institutionalEmail}
        </a>
        .{' '}
        <Link className="font-semibold text-slate-700 transition hover:text-slate-950" to="/info/ajuda">
          Ver ajuda e suporte
        </Link>
      </p>
    </div>
  );
}
