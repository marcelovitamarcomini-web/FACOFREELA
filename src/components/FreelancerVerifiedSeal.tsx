interface FreelancerVerifiedSealProps {
  variant?: 'profile' | 'search';
  label?: string;
}

export function FreelancerVerifiedSeal({
  variant = 'profile',
  label = 'Booster',
}: FreelancerVerifiedSealProps) {
  if (variant === 'search') {
    return (
      <span
        aria-label={label}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-[linear-gradient(135deg,#67e8f9_0%,#06b6d4_55%,#2563eb_100%)] shadow-[0_8px_18px_rgba(14,116,144,0.24)]"
        title={label}
      >
        <span
          className="-translate-y-[0.5px] -rotate-[8deg] text-[14px] font-semibold italic leading-none tracking-[-0.04em] text-white [font-family:Georgia,'Times_New_Roman',serif]"
        >
          f
        </span>
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-800"
      title={label}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] shadow-[0_6px_14px_rgba(37,99,235,0.24)]">
        <svg
          aria-hidden="true"
          className="h-2.5 w-2.5"
          viewBox="0 0 16 16"
        >
          <path
            d="m4 8.2 2.2 2.2L12 4.7"
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </span>
      <span>{label}</span>
    </span>
  );
}
