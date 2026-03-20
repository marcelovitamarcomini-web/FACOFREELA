import { BRAZIL_COUNTRY_CODE, BRAZIL_DDDS, formatBrazilPhoneLocal } from '../lib/phone';

interface PhoneFieldProps {
  error?: string;
  dddValue: string;
  label: string;
  numberValue: string;
  onDddChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  hint?: string;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10';

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
  const inputClassName = hasError
    ? `${fieldClassName} border-rose-300 focus:border-rose-400 focus:ring-rose-400/10`
    : fieldClassName;

  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">{label}</span>

      <div className="grid gap-3 sm:grid-cols-[88px_92px_minmax(0,1fr)]">
        <div className="flex items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
          {BRAZIL_COUNTRY_CODE}
        </div>

        <select
          className={inputClassName}
          onChange={(event) => onDddChange(event.target.value)}
          value={dddValue}
        >
          <option value="">DDD</option>
          {BRAZIL_DDDS.map((ddd) => (
            <option key={ddd} value={ddd}>
              {ddd}
            </option>
          ))}
        </select>

        <input
          className={inputClassName}
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => onNumberChange(formatBrazilPhoneLocal(event.target.value))}
          placeholder="99999-9999"
          type="text"
          value={numberValue}
        />
      </div>

      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}
