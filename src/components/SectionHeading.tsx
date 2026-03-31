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
      <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="max-w-2xl text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}
