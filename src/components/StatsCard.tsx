interface StatsCardProps {
  label: string;
  value: string;
  helper: string;
}

export function StatsCard({ helper, label, value }: StatsCardProps) {
  return (
    <div className="glass-panel rounded-[28px] p-6 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  );
}
