import { cn } from "../../../../utils/cn";

type TripTimestampDisplayProps = {
  value?: string | null;
  empty?: string;
  className?: string;
};

function splitTripTimestamp(value: string): { date: string; time: string } | null {
  const match = value.trim().match(/^(\d{2}-\d{2}-\d{4})\s+(.+)$/);
  if (!match) return null;
  return { date: match[1], time: match[2] };
}

/**
 * Compact, reusable timestamp presentation for Trip view cards.
 * Keeps the full date + time visible while allowing a neat wrap on narrow KPI
 * cards, instead of making the entire card wider or the text oversized.
 */
export function TripTimestampDisplay({ value, empty = "—", className }: TripTimestampDisplayProps) {
  const text = String(value ?? "").trim();
  if (!text || text === "—" || text === "--") {
    return <span className="text-slate-400">{empty}</span>;
  }

  const parts = splitTripTimestamp(text);

  return (
    <span
      title={text}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-1 text-[11px] font-bold leading-none tracking-tight text-slate-800 tabular-nums",
        className,
      )}
    >
      {parts ? (
        <>
          <span>{parts.date}</span>
          <span className="text-slate-400" aria-hidden="true">•</span>
          <span>{parts.time}</span>
        </>
      ) : (
        <span>{text}</span>
      )}
    </span>
  );
}

export default TripTimestampDisplay;
