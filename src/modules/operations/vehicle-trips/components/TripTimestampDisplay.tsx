import { cn } from "../../../../utils/cn";

type TripTimestampDisplayProps = {
  value?: string | null;
  empty?: string;
  className?: string;
};

/**
 * Compact, reusable one-line timestamp presentation for Trip view cards.
 * Shows the full date + time as plain text — no inner box/chip — so the KPI
 * card stays clean while the value remains readable and perfectly fitted.
 */
export function TripTimestampDisplay({ value, empty = "—", className }: TripTimestampDisplayProps) {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "--") {
    return <span className="text-slate-400">{empty}</span>;
  }

  return (
    <span
      className={cn(
        "inline-block max-w-full min-w-0 text-[12px] font-extrabold leading-snug tracking-[-0.025em] text-slate-900 tabular-nums whitespace-nowrap",
        className,
      )}
    >
      {text}
    </span>
  );
}

export default TripTimestampDisplay;
