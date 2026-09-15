import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
/** One extremely slow ambient revolution — 20 minutes per lap, always on. */
const ORBIT_MS = 1200_000;

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

/**
 * Collection Streams — payment-mode donut for the Operations dashboard.
 *
 * Simple & proper by design:
 *  • A flat 2D donut sitting EXACTLY in the middle of the card's chart box
 *    (the stage fills the free space between the title and the KPI strip).
 *  • A KPI strip pinned to the BOTTOM of the card — one box per mode with
 *    its exact amount and share, in the same visual language as the Trips
 *    chart's KPI row. It is `shrink-0`, so it can never be squeezed out:
 *    the KPIs are ALWAYS visible below the chart.
 *  • Loading: an animated donut skeleton (soft track + orbiting arc +
 *    pulsing KPI boxes) until the first data arrives.
 *  • Every load / range change replays a choreographed entrance: the donut
 *    fades in, the slices sweep in, the centre total counts up, and the
 *    KPI boxes rise in staggered.
 *  • One very slow ambient revolution of the ring (8 min per lap, off with
 *    reduced-motion); hovering a slice lifts it out, the others stay solid.
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
  // signature changes, which re-keys the scene + KPI strip and replays the
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
      if (spinRef.current) spinRef.current.style.transform = "";
    };

    const start = () => {
      if (running) return;
      running = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (!running) return;
        if (spinRef.current) {
          spinRef.current.style.transform = `rotate(${((((now - t0) / ORBIT_MS) * 360) % 360).toFixed(3)}deg)`;
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

  // ── Loading / empty: an animated donut skeleton, KPI boxes still pinned
  //    at the bottom so the card shape never jumps. ───────────────────────
  if (chartData.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-1 flex-col" aria-busy="true">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <div className="relative aspect-square w-full max-w-[470px]" style={{ aspectRatio: "1 / 1" }}>
            <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
              {/* soft track */}
              <circle cx="200" cy="200" r="91" fill="none" stroke="#eef2f7" strokeWidth="33" />
              {/* orbiting arc — the "aggregating" motion */}
              <g
                className="animate-[spin_1.6s_linear_infinite]"
                style={{ transformBox: "view-box", transformOrigin: "200px 200px" }}
              >
                <circle
                  cx="200"
                  cy="200"
                  r="91"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="33"
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
        <div className="grid w-full shrink-0 grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[52px] animate-pulse rounded-xl bg-slate-100/80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">

      {/* The donut FILLS the card's free space and sits exactly in the
          middle of the chart box. Re-keyed on every data change so the
          entrance (fade + slice sweep) replays for each new range. */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          key={signature}
          className="relative aspect-square max-h-full w-full max-w-[470px] animate-fade-in"
          style={{ aspectRatio: "1 / 1" }}
        >
          {/* Soft background track behind the ring (same 74.24–107.5 band).
              SVG circle so it scales with the scene at every card width. */}
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="200" cy="200" r="91" fill="none" stroke="rgba(241,245,249,0.8)" strokeWidth="33" />
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
                  innerRadius="37.12%"
                  outerRadius="53.75%"
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
      {/* KPI strip — BELOW the chart. shrink-0 so it can never be
          squeezed out of the card: the KPIs are always perfectly visible.
          One simple box per mode, same visual language as the Trips
          chart's KPI row; re-keyed on data change so the staggered rise
          replays for each new range. */}
      <div key={`kpi-${signature}`} className="grid w-full shrink-0 grid-cols-3 gap-2 border-t border-slate-100 pt-3">
        {enrichedData.map((d, index) => (
          <div
            key={d.name}
            className="group min-w-0 animate-fade-in-up cursor-default rounded-xl px-2.5 py-2 ring-1 ring-inset ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ backgroundColor: `${d.color}0f`, animationDelay: `${260 + index * 90}ms` }}
          >
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-150"
                  style={{ backgroundColor: d.color }}
                />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="block truncate text-[14px] font-black tabular-nums text-slate-800">
                  {formatINRCompact(d.value)}
                </span>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                  {`${d.percent.toFixed(1)}%`}
                </span>
              </span>
          </div>
        ))}
      </div>
    </div>
  );
}
