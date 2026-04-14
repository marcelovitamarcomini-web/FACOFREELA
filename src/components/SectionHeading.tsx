interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function SectionHeading({ description, eyebrow, title }: SectionHeadingProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
        {eyebrow}
      </p>
      <h2 className="max-w-3xl text-[1.95rem] font-semibold leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-[2.35rem] lg:text-4xl">
        {title}
      </h2>
      <p className="max-w-2xl text-[0.98rem] leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}
