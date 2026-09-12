import { cn } from "../../../../utils/cn";

type TripTimestampDisplayProps = {
  value?: string | null;
  empty?: string;
  className?: string;
};

/**
 * Compact, reusable one-line timestamp presentation for Trip view cards.
 * Keeps full date + time visible in a smaller, neat chip without changing
 * surrounding KPI/card widths.
 */
export function TripTimestampDisplay({ value, empty = "—", className }: TripTimestampDisplayProps) {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "--") {
    return <span className="text-slate-400">{empty}</span>;
  }

  return (
    <span
      title={text}
      className={cn(
        "inline-flex max-w-full items-center rounded-lg border border-sky-100 bg-sky-50/70 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-tight text-slate-800 tabular-nums whitespace-nowrap",
        className,
      )}
    >
      {text}
    </span>
  );
}

export default TripTimestampDisplay;
