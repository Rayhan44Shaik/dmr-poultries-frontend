import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const PIE_TRACK = { radius: 112, strokeWidth: 48 } as const;
/** An almost imperceptible ambient revolution — 60 minutes per lap. */
const ORBIT_MS = 3600_000;

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
}

interface EnrichedMode {
  name: string;
  value: number;
  percent: number;
  color: string;
  gid: string;
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

function CollectionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: unknown }>;
}) {
  if (!active) return null;
  const item = payload?.[0]?.payload as Partial<EnrichedMode> | undefined;
  if (!item || typeof item.name !== "string") return null;

  const value = Number(item.value) || 0;
  const percent = Number(item.percent) || 0;
  const color = typeof item.color === "string" ? item.color : "#64748b";

  return (
    <div
      className="min-w-[190px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-sm"
      style={{
        transform: "rotate(calc(-1 * var(--cs-pie-angle, 0deg)))",
        transformOrigin: "center center",
      }}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{item.name}</p>
      </div>
      <p className="mt-2 text-[16px] font-black tabular-nums text-slate-800">{formatINRCompact(value)}</p>
      <p className="mt-0.5 text-[12px] font-black tabular-nums" style={{ color }}>
        {percent.toFixed(1)}% of collection streams
      </p>
    </div>
  );
}

/**
 * Collection Streams — payment-mode donut for the Operations dashboard.
 *
 * Simple & proper by design:
 *  • A flat 2D donut centered in the chart stage, with the payment-mode KPI
 *    row beneath it, matching the Trip Movement chart's footer geometry.
 *  • One KPI box per mode with its exact amount and share, using the same
 *    spacing, typography, border, animation, and grid treatment as Trip
 *    Movement. The row is `shrink-0`, so it stays readable and in sync.
 *  • Loading: an animated donut skeleton (soft track + orbiting arc +
 *    pulsing KPI boxes) until the first data arrives.
 *  • Every load / range change replays a choreographed entrance: the donut
 *    fades in, the slices sweep in, and the centre total counts up while the
 *    KPI values remain directly bound to the same data signature.
 *  • One almost imperceptible ambient revolution of the ring (60 min per lap,
 *    off with reduced-motion); hovering a slice lifts it out, the others stay solid.
 *  • Slice colours are bound to the slice's own name (stable gradient ids),
 *    never to its array position.
 */
export default function CollectionsPie({ data }: CollectionsPieProps) {
  const { t } = useI18n();
  const chartData = useMemo(() => data ?? [], [data]);

  const enrichedData = useMemo<EnrichedMode[]>(() => {
    const total = chartData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return chartData.map((d, i) => ({
      name: d.name,
      value: Number(d.value) || 0,
      percent: total > 0 ? ((Number(d.value) || 0) / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
      gid: slug(d.name),
    }));
  }, [chartData]);

  const total = useMemo(
    () => enrichedData.reduce((sum, d) => sum + d.value, 0),
    [enrichedData]
  );
  const animatedTotal = useCountUp(total);

  // Signature of the exact data on screen. When a NEW range's data lands the
  // signature changes, which re-keys the scene + KPI footer and replays the
  // whole entrance choreography. Identical data (session-cache hits) keeps
  // the same signature — no flicker on instant range switches.
  const signature = useMemo(
    () => chartData.map((d) => `${d.name}:${Math.round(Number(d.value) || 0)}`).join("|"),
    [chartData]
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
          cornerRadius={6}
          fill={gid ? `url(#cs-grad-${gid})` : (props.fill ?? "#94a3b8")}
        />
      );
    },
    []
  );

  // ---- one rotation clock (rAF) — the ring only -------------------------
  // The donut wrapper makes one very slow ambient revolution; the angle is
  // derived from wall-clock time, so even a backgrounded tab snaps back to
  // the correct position the moment it wakes. Off with reduced-motion.
  const spinRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = false;

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      if (spinRef.current) {
        spinRef.current.style.transform = "";
        spinRef.current.style.setProperty("--cs-pie-angle", "0deg");
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (!running) return;
        if (spinRef.current) {
          const angle = `${((((now - t0) / ORBIT_MS) * 360) % 360).toFixed(3)}deg`;
          spinRef.current.style.transform = `rotate(${angle})`;
          spinRef.current.style.setProperty("--cs-pie-angle", angle);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const sync = () => (mq.matches ? stop() : start());
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      cancelAnimationFrame(frame);
    };
  }, []);

  // The collection KPI row follows the same footer contract as Trip Movement:
  // full width, fixed below the chart, and keyed to the exact data signature.
  const modeKpis = (
    <div
      key={`kpi-${signature}`}
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
      {/* The donut stays centered in the available chart stage. Its KPI row
          follows underneath with the same spacing used by Trip Movement. */}
      <div className="min-h-[21.25rem] w-full flex-1" style={{ minHeight: "21.25rem" }}>
        <div className="flex h-full w-full items-center justify-center">
          <div
            key={signature}
            className="relative aspect-square max-h-full w-full max-w-[560px] animate-fade-in"
            style={{ aspectRatio: "1 / 1" }}
          >
          {/* Soft background track behind the enlarged ring (88–136 band).
              SVG circle so it scales with the scene at every card width. */}
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle
              cx="200"
              cy="200"
              r={PIE_TRACK.radius}
              fill="none"
              stroke="rgba(241,245,249,0.8)"
              strokeWidth={PIE_TRACK.strokeWidth}
            />
          </svg>

          {/* The rotating wrapper — the rAF loop sets its transform. */}
          <div ref={spinRef} className="cs-pie-spin h-full w-full [will-change:transform]">
            <div className="h-full w-full [filter:drop-shadow(0_8px_16px_-12px_rgba(15,23,42,0.3))]">
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
                  innerRadius="44%"
                  outerRadius="68%"
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                  shape={renderSector}
                  animationBegin={150}
                  animationDuration={900}
                  animationEasing="ease-out"
                >
                  {enrichedData.map((d) => (
                    <Cell key={d.gid} fill={`url(#cs-grad-${d.gid})`} />
                  ))}
                </Pie>
                <Tooltip content={<CollectionTooltip />} cursor={false} />
              </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Centre total — count-up on load / range change (never rotates). */}
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
    </div>
    {modeKpis}
  </div>
  );
}
