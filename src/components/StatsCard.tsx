interface StatsCardProps {
  label: string;
  value: string;
  helper: string;
}

export function StatsCard({ helper, label, value }: StatsCardProps) {
  return (
    <div className="glass-panel rounded-[28px] p-5 shadow-soft sm:p-6">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-[1.8rem] font-extrabold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
