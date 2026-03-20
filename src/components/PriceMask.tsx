import { Link, type To } from 'react-router-dom';

interface PriceMaskProps {
  hint?: string;
  to?: To;
  state?: unknown;
  compact?: boolean;
  ctaLabel?: string;
}

export function PriceMask({
  hint,
  state,
  to = '/login',
  compact = false,
  ctaLabel = 'Saiba mais',
}: PriceMaskProps) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-1'}>
      <p className="font-mono text-lg font-semibold tracking-[0.38em] text-slate-900">****</p>
      <Link
        className="inline-flex text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 transition hover:text-cyan-500"
        state={state}
        to={to}
      >
        {ctaLabel}
      </Link>
      {hint ? (
        <p className={`text-slate-500 ${compact ? 'text-[11px] leading-4' : 'text-xs leading-5'}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
