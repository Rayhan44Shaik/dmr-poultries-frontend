import { CheckCircle2 } from "lucide-react";

interface RowSelectMarkProps {
  /** True for the single selected row. */
  selected: boolean;
  /** The row's displayed serial number (hidden when selected). */
  serialNo: number | string;
  /** Accessible name announced with the row's aria-selected state. */
  label?: string;
}

/**
 * Serial-position selection mark shared by Operations tables: the row's
 * serial number normally, replaced by a small emerald check-circle for the
 * selected row. Selection never depends on colour alone.
 */
export function RowSelectMark({ selected, serialNo, label }: RowSelectMarkProps) {
  if (!selected) return <>{serialNo}</>;
  return (
    <span className="inline-flex items-center justify-center" role="img" aria-label={label ?? "Selected"}>
      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
    </span>
  );
}
