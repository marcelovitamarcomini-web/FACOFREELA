import type { ChangeEvent } from 'react';

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  textarea?: boolean;
  options?: string[];
  optional?: boolean;
  min?: string;
  step?: string;
}

const fieldClassName =
  'w-full rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10';

export function FormField({
  error,
  label,
  min,
  name,
  onChange,
  optional,
  options,
  placeholder,
  step,
  textarea,
  type = 'text',
  value,
}: FormFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {label}
        {optional ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Opcional
          </span>
        ) : null}
      </span>

      {options ? (
        <select className={fieldClassName} name={name} onChange={onChange} value={value}>
          <option value="">Selecione</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          className={`${fieldClassName} min-h-[140px] resize-y`}
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          value={value}
        />
      ) : (
        <input
          className={fieldClassName}
          min={min}
          name={name}
          onChange={onChange}
          placeholder={placeholder}
          step={step}
          type={type}
          value={value}
        />
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </label>
  );
}
