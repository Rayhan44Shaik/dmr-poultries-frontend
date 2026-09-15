import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, type PieSectorShapeProps } from "recharts";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
/** One very slow ambient revolution — 8 minutes per lap. */
const ORBIT_MS = 480_000;

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
 * Simple & proper by design: a flat 2D donut sitting EXACTLY in the middle
 * of the card's chart box (the stage fills the free space between the title
 * and the KPI strip), the period total in the centre with a count-up, and
 * a KPI strip at the bottom with one box per mode — amount + exact share —
 * in the same visual language as the Trips chart's KPI row. There are NO
 * toggle badges on the ring. Slices sweep in on mount / range change; the
 * ring makes one very slow ambient revolution (8 min per lap, off with
 * reduced-motion); hovering a slice lifts it out, the others stay solid.
 * Slice colours are bound to the slice's own name (stable gradient ids),
 * never to its array position.
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

  if (chartData.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-1 items-center justify-center py-10 text-center text-sm text-slate-400">
        {t("empty.no_data")}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {/* The donut FILLS the card's free space and sits exactly in the
          middle of the chart box: the stage wrapper takes whatever height
          is left (title + KPI strip aside) and the square scene grows to
          the largest size that fits — no leftover white space, on any
          card size. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4">
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <div className="relative aspect-square max-h-full w-full" style={{ aspectRatio: "1 / 1" }}>
          {/* Soft background track behind the ring (same 74.24–107.5 band).
              SVG circle so it scales with the scene at every card width. */}
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="200" cy="200" r="91" fill="none" stroke="rgba(241,245,249,0.8)" strokeWidth="33" />
          </svg>

          {/* The rotating wrapper — the rAF loop sets its transform. */}
          <div ref={spinRef} className="cs-pie-spin h-full w-full">
            <div className="h-full w-full [filter:drop-shadow(0_18px_26px_-16px_rgba(15,23,42,0.35))]">
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

        {/* KPI strip — one box per mode (amount + exact share), in the same
            simple visual language as the Trips chart's KPI row. */}
        <div className="grid w-full min-w-0 grid-cols-3 gap-2 border-t border-slate-100 pt-3">
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
                <span className="ml-auto shrink-0 tabular-nums">{`${d.percent.toFixed(1)}%`}</span>
              </span>
              <span className="mt-0.5 block truncate text-[15px] font-black tabular-nums text-slate-800">
                {formatINRCompact(d.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
