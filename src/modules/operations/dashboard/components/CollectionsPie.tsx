import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
/** Lighten a hex colour toward white (for the slice gradient top stop). */
function lighten(hex: string, amt = 0.22): string {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const f = (v: number) => Math.round(v + (255 - v) * amt);
  return `rgb(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

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

/**
 * Collection Streams — payment-mode donut for the Operations dashboard.
 *
 * A fixed 240 px square stage keeps the ring a perfect circle at every window
 * size, with generous white space on all sides. Slices sweep in on mount /
 * range change, and on hover a % badge springs in right at that slice's own
 * mid-angle (while it lifts and the rest dim). Every slice keeps a quiet
 * rounded % label, sits on a soft background track, and the legend below
 * lists every mode with exact amount and share. The card title links to the
 * Collection Report.
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

  // recharts v3: the per-sector shape gets `isActive` for the hovered slice —
  // lift it (bigger outer radius), dim the rest, and paint the % label at the
  // slice's own mid-angle while it is settled (not mid-sweep).
  const renderSector = useCallback(
    (props: PieSectorShapeProps) => {
      const {
        cx,
        cy,
        innerRadius,
        outerRadius,
        startAngle,
        endAngle,
        isActive,
        index,
        midAngle,
        middleRadius,
        isAnimating,
      } = props;
      const mode = enrichedData[index];
      const oR = isActive ? (outerRadius ?? 0) + 8 : outerRadius;
      const dimmed = hoverIndex !== -1 && !isActive;
      const showLabel = !isAnimating && (mode?.percent ?? 0) >= 6 && midAngle != null && middleRadius != null;
      const rad = ((midAngle ?? 0) * Math.PI) / 180;
      const lx = (cx ?? 0) + (middleRadius ?? 0) * Math.cos(rad) + (isActive ? 4 : 0);
      const ly = (cy ?? 0) + (middleRadius ?? 0) * Math.sin(rad) + (isActive ? 4 : 0);
      return (
        <g opacity={dimmed ? 0.35 : 1} style={{ transition: "opacity 180ms ease" }}>
          <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={oR}
            startAngle={startAngle}
            endAngle={endAngle}
            cornerRadius={6}
            fill={`url(#cs-grad-${index})`}
          />
          {showLabel &&
            (isActive ? (
              /* Pop badge — springs in right on the hovered slice's own spot
                 (its mid-angle), showing the exact share. */
              <g transform={`translate(${lx}, ${ly})`} style={{ pointerEvents: "none" }}>
                <g
                  className="animate-pop-in"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                >
                  <rect x={-27} y={-12.5} width={54} height={25} rx={12.5} fill="rgba(15, 23, 42, 0.92)" />
                  <text
                    x={0}
                    y={0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11.5}
                    fontWeight={800}
                    fill="#ffffff"
                  >
                    {mode!.percent.toFixed(1)}%
                  </text>
                </g>
              </g>
            ) : (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill="#ffffff"
                style={{ pointerEvents: "none" }}
              >
                {mode!.percent.toFixed(0)}%
              </text>
            ))}
        </g>
      );
    },
    [enrichedData, hoverIndex]
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
      {/* Donut — fixed square stage, generous white space on all sides. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        <div className="relative h-64 w-64">
          {/* Soft background track behind the ring (matches the 58%–84% band). */}
          <div className="absolute left-1/2 top-1/2 h-[215px] w-[215px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[33px] border-slate-100/80" />

          <div className="h-full w-full [filter:drop-shadow(0_18px_26px_-16px_rgba(15,23,42,0.35))]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {enrichedData.map((d, i) => (
                    <linearGradient key={d.name} id={`cs-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={lighten(d.color)} />
                      <stop offset="100%" stopColor={d.color} />
                    </linearGradient>
                  ))}
                </defs>
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
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Centre total — count-up on load / range change. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t("ops.dashboard.collection_streams_total")}
            </span>
            <span className="mt-1 text-[24px] font-black leading-none tracking-tight text-slate-800 tabular-nums">
              {formatINRCompact(animatedTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Legend — every mode with exact amount and share, tight & staggered. */}
      <ul className="mt-2 w-full flex-shrink-0 space-y-1 border-t border-slate-100 pt-2.5">
        {enrichedData.map((d, index) => (
          <li
            key={d.name}
            className="flex animate-fade-in-up items-center gap-2"
            style={{ animationDelay: `${260 + index * 90}ms` }}
          >
            <span
              className="h-2 w-2 flex-shrink-0 rounded-[3px]"
              style={{ background: `linear-gradient(180deg, ${lighten(d.color)}, ${d.color})` }}
            />
            <span className="truncate text-[11.5px] font-semibold text-slate-600">{d.name}</span>
            <span className="ml-auto text-[11.5px] font-bold tabular-nums text-slate-700">
              {formatINRCompact(d.value)}
            </span>
            <span className="w-10 text-right text-[10.5px] font-semibold tabular-nums text-slate-400">
              {d.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
