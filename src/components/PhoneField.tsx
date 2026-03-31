import { BRAZIL_DDDS, formatBrazilPhoneLocal } from '../lib/phone';

interface PhoneFieldProps {
  error?: string;
  dddValue: string;
  label: string;
  numberValue: string;
  onDddChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  hint?: string;
}

export function PhoneField({
  dddValue,
  error,
  hint,
  label,
  numberValue,
  onDddChange,
  onNumberChange,
}: PhoneFieldProps) {
  const hasError = Boolean(error);

  return (
    <label className="block space-y-2.5">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">{label}</span>

      <div
        className={`rounded-[28px] border p-2 transition ${
          hasError
            ? 'border-rose-300 bg-rose-50/30'
            : 'border-slate-200/80 bg-white/92 shadow-[0_10px_24px_rgba(15,23,42,0.04)]'
        }`}
      >
        <div className="grid gap-2 sm:grid-cols-[124px_minmax(0,1fr)]">
          <div className="flex min-h-[74px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              DDD
            </p>
            <select
              className="mt-1 w-full appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none"
              onChange={(event) => onDddChange(event.target.value)}
              value={dddValue}
            >
              <option value="">Selecione</option>
              {BRAZIL_DDDS.map((ddd) => (
                <option key={ddd} value={ddd}>
                  {ddd}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-[74px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Celular ou WhatsApp
            </p>
            <input
              className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => onNumberChange(formatBrazilPhoneLocal(event.target.value))}
              placeholder="99999-9999"
              type="text"
              value={numberValue}
            />
          </div>
        </div>

        {hint ? <p className="px-2 pt-3 text-xs leading-5 text-slate-500">{hint}</p> : null}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}
