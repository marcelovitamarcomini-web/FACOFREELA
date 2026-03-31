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
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#0071e3]/25 bg-[linear-gradient(135deg,#69a8ff_0%,#0071e3_55%,#004aad_100%)] shadow-[0_8px_18px_rgba(0,113,227,0.18)]"
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
      className="inline-flex items-center gap-1.5 rounded-full border border-[#0071e3]/20 bg-[#0071e3]/8 px-2.5 py-1 text-[11px] font-semibold text-[#0059b3]"
      title={label}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[linear-gradient(135deg,#56a0ff_0%,#0071e3_100%)] shadow-[0_6px_14px_rgba(0,113,227,0.18)]">
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
