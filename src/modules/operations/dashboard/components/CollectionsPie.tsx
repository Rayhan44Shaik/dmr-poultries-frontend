import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINR, formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface CollectionsPieProps {
  data: { name: string; value: number }[];
}

interface EnrichedMode {
  name: string;
  value: number;
  percent: number;
  color: string;
}

/** Ease-out count-up for the centre total (rAF driven, ~900 ms). */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const anim = useRef({ target: 0, start: 0, frame: 0 });

  useEffect(() => {
    const s = anim.current;
    s.target = target;
    s.start = performance.now();
    cancelAnimationFrame(s.frame);
    const tick = (now: number) => {
      if (s.target <= 0) {
        setValue(0);
        return;
      }
      const p = Math.min(1, (now - s.start) / duration);
      setValue(s.target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.frame);
  }, [target, duration]);

  return value;
}

interface ModeTooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: EnrichedMode }>;
}

/** Floating detail chip: mode, exact amount and share of the total. */
function ModeTooltip({ active, payload }: ModeTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const value = Number(row.value ?? 0);
  const percent = row.payload?.percent ?? 0;
  const color = row.payload?.color ?? COLORS[0];
  return (
    <div className="rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-1.5 font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {row.name}
      </div>
      <div className="mt-0.5 text-[13px] font-black tabular-nums">{formatINR(value)}</div>
      <div className="tabular-nums text-slate-300">{percent.toFixed(1)}% of total</div>
    </div>
  );
}

/**
 * Collection Streams — payment-mode donut for the Operations dashboard.
 *
 * Renders as a clean, self-contained block inside its card (the card chrome
 * comes from the page): a fixed 224 px square keeps the ring perfectly
 * circular at every window size, the slice sweep animates on mount / range
 * change, hover lifts the slice and dims the rest, and the legend carries the
 * full info (mode · amount · share). The card title links to the Collection
 * Report, so there is no duplicate "view details" affordance.
 */
export default function CollectionsPie({ data }: CollectionsPieProps) {
  const { t } = useI18n();
  const chartData = useMemo(() => data ?? [], [data]);
  const [hoverIndex, setHoverIndex] = useState(-1);

  const enrichedData = useMemo<EnrichedMode[]>(() => {
    const total = chartData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return chartData.map((d, i) => ({
      name: d.name,
      value: Number(d.value) || 0,
      percent: total > 0 ? ((Number(d.value) || 0) / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));
  }, [chartData]);

  const total = useMemo(
    () => enrichedData.reduce((sum, d) => sum + d.value, 0),
    [enrichedData]
  );
  const animatedTotal = useCountUp(total);

  // recharts v3: the per-sector shape receives `isActive` for the hovered
  // slice — lift it (bigger outer radius) and let the rest dim.
  const renderSector = useCallback(
    (props: PieSectorShapeProps) => {
      const {
        cx,
        cy,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        fill,
        isActive,
        index,
      } = props;
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={isActive ? (outerRadius ?? 0) + 8 : outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          cornerRadius={6}
          fill={fill ?? COLORS[index % COLORS.length]}
          opacity={hoverIndex !== -1 && !isActive ? 0.35 : 1}
          style={{ transition: "opacity 180ms ease" }}
        />
      );
    },
    [hoverIndex]
  );

  if (chartData.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-1 items-center justify-center py-10 text-center text-sm text-slate-400">
        {t("empty.no_data")}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {/* Donut — fixed square stage so the circle always fits, hover headroom included. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative h-56 w-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={enrichedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="84%"
                paddingAngle={3}
                cornerRadius={6}
                stroke="none"
                shape={renderSector}
                onMouseOver={(_entry, index) => setHoverIndex(index)}
                onMouseOut={() => setHoverIndex(-1)}
                animationBegin={150}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {enrichedData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<ModeTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre total — count-up on load / range change. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[19px] font-black tracking-tight text-slate-800 tabular-nums">
              {formatINRCompact(animatedTotal)}
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {t("ops.dashboard.collection_streams_total")}
            </span>
          </div>
        </div>
      </div>

      {/* Legend — every mode with exact amount and share, staggered in. */}
      <ul className="mt-3 w-full flex-shrink-0 space-y-1.5 border-t border-slate-100 pt-3">
        {enrichedData.map((d, index) => (
          <li
            key={d.name}
            className="flex animate-fade-in-up items-center gap-2"
            style={{ animationDelay: `${260 + index * 90}ms` }}
          >
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-[4px]"
              style={{ background: d.color }}
            />
            <span className="truncate text-xs font-semibold text-slate-600">{d.name}</span>
            <span className="ml-auto text-xs font-bold tabular-nums text-slate-700">
              {formatINRCompact(d.value)}
            </span>
            <span className="w-11 text-right text-[11px] font-semibold tabular-nums text-slate-400">
              {d.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
