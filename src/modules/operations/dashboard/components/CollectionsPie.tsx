import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const PIE_TRACK = { radius: 132, strokeWidth: 48 } as const;

function modeColor(name: string, index: number): string {
  const key = name.toLocaleLowerCase("en-IN");
  if (key.includes("union")) return "#3b82f6";
  if (key.includes("hdfc")) return "#10b981";
  if (key.includes("cash")) return "#f59e0b";
  return COLORS[index % COLORS.length];
}

/** Stable id fragment for a mode name (gradient ids never depend on order). */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Lighten a hex colour toward white (for the slice gradient top stop). */
function lighten(hex: string, amt = 0.22): string {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const f = (v: number) => Math.round(v + (255 - v) * amt);
  return `rgb(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
}

interface CollectionsPieProps {
  data: { name: string; value: number }[];
  animationKey?: number;
}

interface EnrichedMode {
  name: string;
  value: number;
  percent: number;
  color: string;
  gid: string;
}

/** Ease-out count-up for the centre total (rAF driven, ~900 ms). */
function useCountUp(target: number, duration = 900, replayKey = 0): number {
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
  }, [target, duration, replayKey]);

  return value;
}

function CollectionStat({
  name,
  value,
  percent,
  color,
}: Pick<EnrichedMode, "name" | "value" | "percent" | "color">) {
  return (
    <div
      className="group min-w-0 cursor-default rounded-xl px-2.5 py-2 ring-1 ring-inset ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ backgroundColor: `${color}0f` }}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{name}</span>
      </span>
      <span className="mt-0.5 flex items-baseline justify-between gap-1">
        <span className="block truncate text-[15px] font-black tabular-nums text-slate-800">
          {formatINRCompact(value)}
        </span>
        <span
          className="shrink-0 rounded-md bg-white/90 px-1.5 py-0.5 text-[12px] font-black tabular-nums shadow-sm ring-1 ring-inset ring-white"
          style={{ color }}
        >
          {`${percent.toFixed(1)}%`}
        </span>
      </span>
    </div>
  );
}

/**
 * Payment-mode donut with stable bank/cash colours, direct amount/share
 * callouts, a selected-period total, and the existing KPI summary beneath it.
 */
export default function CollectionsPie({ data, animationKey = 0 }: CollectionsPieProps) {
  const { t } = useI18n();
  const chartData = useMemo(() => data ?? [], [data]);

  const enrichedData = useMemo<EnrichedMode[]>(() => {
    const total = chartData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return chartData.map((d, i) => ({
      name: d.name,
      value: Number(d.value) || 0,
      percent: total > 0 ? ((Number(d.value) || 0) / total) * 100 : 0,
      color: modeColor(d.name, i),
      gid: slug(d.name),
    }));
  }, [chartData]);

  const total = useMemo(
    () => enrichedData.reduce((sum, d) => sum + d.value, 0),
    [enrichedData]
  );
  const animatedTotal = useCountUp(total, 900, animationKey);

  // Signature of the exact data on screen. When a NEW range's data lands the
  // signature changes, which re-keys the scene + KPI footer and replays the
  // whole entrance choreography. Identical data (session-cache hits) keeps
  // the same signature — no flicker on instant range switches.
  const dataSignature = useMemo(
    () => `${animationKey}|${chartData.map((d) => `${d.name}:${Math.round(Number(d.value) || 0)}`).join("|")}`,
    [chartData, animationKey]
  );

  // recharts v3: the per-sector shape gets `isActive` for the hovered slice —
  // just lift it (bigger outer radius). The other slices stay fully solid.
  const renderSector = useCallback(
    (props: PieSectorShapeProps) => {
      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, isActive } = props;
      const oR = isActive ? (outerRadius ?? 0) + 8 : outerRadius;
      // Identify the slice by its OWN data (the payload travels with the
      // sector through any recharts re-ordering or data-change animation) —
      // never by array index — so a slice can never be painted with another
      // slice's colour.
      const name = (props.payload as { name?: string } | null | undefined)?.name;
      const gid = name ? slug(name) : "";
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={oR}
          startAngle={startAngle}
          endAngle={endAngle}
          cornerRadius={7}
          fill={gid ? `url(#cs-grad-${gid})` : (props.fill ?? "#94a3b8")}
          stroke="#ffffff"
          strokeWidth={2}
        />
      );
    },
    []
  );

  // The collection KPI row follows the same footer contract as Trip Movement:
  // full width, fixed below the chart, and keyed to the exact data signature.
  const modeKpis = (
    <div
      key={`kpi-${dataSignature}`}
      aria-label={t("ops.dashboard.collection_streams")}
      className="mt-3 grid w-full shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3"
    >
      {enrichedData.map((d) => (
        <CollectionStat key={d.name} {...d} />
      ))}
    </div>
  );

  // ── Loading / empty: preserve the same chart-then-footer geometry. ─────
  if (chartData.length === 0) {
    return (
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" aria-busy="true">
        <div className="min-h-[21.25rem] w-full flex-1" style={{ minHeight: "21.25rem" }}>
          <div className="flex h-full w-full items-center justify-center">
          <div className="relative aspect-square w-full max-w-[560px]" style={{ aspectRatio: "1 / 1" }}>
            <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
              <circle
                cx="200"
                cy="200"
                r={PIE_TRACK.radius}
                fill="none"
                stroke="#eef2f7"
                strokeWidth={PIE_TRACK.strokeWidth}
              />
              <g
                className="animate-[spin_1.6s_linear_infinite]"
                style={{ transformBox: "view-box", transformOrigin: "200px 200px" }}
              >
                <circle
                  cx="200"
                  cy="200"
                  r={PIE_TRACK.radius}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={PIE_TRACK.strokeWidth}
                  strokeDasharray="429 143"
                  strokeLinecap="round"
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="animate-pulse text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {t("ops.dashboard.collection_streams_total")}
              </span>
              <span className="h-6 w-24 animate-pulse rounded-md bg-slate-100" />
            </div>
          </div>
          </div>
        </div>
        <div className="mt-3 grid w-full shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[3.25rem] animate-pulse rounded-xl bg-slate-100/80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="relative min-h-[21.25rem] w-full flex-1" style={{ minHeight: "21.25rem" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={dataSignature}
            className="cs-pie-spin relative aspect-square w-full max-w-[20rem] animate-fade-in"
            style={{ aspectRatio: "1 / 1" }}
          >
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle
                cx="200"
                cy="200"
                r={PIE_TRACK.radius}
                fill="none"
                stroke="rgba(241,245,249,0.9)"
                strokeWidth={PIE_TRACK.strokeWidth}
              />
            </svg>

            <div className="h-full w-full [filter:drop-shadow(0_10px_18px_-14px_rgba(15,23,42,0.35))]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {enrichedData.map((d) => (
                      <linearGradient key={d.gid} id={`cs-grad-${d.gid}`} x1="0%" y1="0%" x2="0%" y2="100%">
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
                    innerRadius="54%"
                    outerRadius="78%"
                    paddingAngle={3}
                    cornerRadius={7}
                    stroke="#ffffff"
                    strokeWidth={2}
                    shape={renderSector}
                    animationBegin={100}
                    animationDuration={760}
                    animationEasing="ease-out"
                  >
                    {enrichedData.map((d) => (
                      <Cell key={d.gid} fill={`url(#cs-grad-${d.gid})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {t("ops.dashboard.collection_streams_total")}
              </span>
              <span className="mt-1 text-[24px] font-black leading-none tracking-tight text-slate-800 tabular-nums">
                {formatINRCompact(animatedTotal)}
              </span>
            </div>
          </div>
        </div>

        {enrichedData.slice(0, 3).map((mode, index) => {
          const onLeft = index === 1;
          const position = index === 0
            ? "right-0 top-[16%]"
            : index === 1
              ? "left-0 top-[43%]"
              : "right-0 bottom-[16%]";
          const details = (
            <span className={onLeft ? "text-left" : "text-right"}>
              <span className="block max-w-[7.5rem] truncate text-[8.5px] font-bold uppercase tracking-wide text-slate-400">
                {mode.name}
              </span>
              <strong className="block text-[13px] font-black tabular-nums text-slate-800">
                {formatINRCompact(mode.value)}
              </strong>
              <span className="inline-flex items-center gap-1 text-[9.5px] font-black tabular-nums" style={{ color: mode.color }}>
                <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: mode.color }} />
                {mode.percent.toFixed(1)}%
              </span>
            </span>
          );
          return (
            <div key={`callout-${mode.gid}`} className={`pointer-events-none absolute hidden items-center gap-1.5 sm:flex ${position}`}>
              {onLeft ? details : <span className="h-px w-7" style={{ backgroundColor: mode.color }} />}
              {onLeft ? <span className="h-px w-7" style={{ backgroundColor: mode.color }} /> : details}
            </div>
          );
        })}
      </div>
      {modeKpis}
    </div>
  );
}
