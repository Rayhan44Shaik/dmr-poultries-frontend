// src/ui/BrandMark.tsx

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { box: "h-8 w-8 rounded-lg text-base", icon: "h-4 w-4" },
  md: { box: "h-9 w-9 rounded-[10px] text-lg", icon: "h-4.5 w-4.5" },
  lg: { box: "h-11 w-11 rounded-xl text-xl", icon: "h-5 w-5" },
} as const;

/** DMR Poultries brand mark — deep emerald monogram tile. */
export default function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  const s = sizes[size];
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-800 font-bold text-white shadow-sm ring-1 ring-emerald-900/20 ${s.box} ${className}`}
      aria-hidden="true"
    >
      <span className="translate-y-px">D</span>
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-white dark:ring-slate-900" />
    </div>
  );
}
