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
 * Compact side-by-side layout: the square scene (fixed 250 px stage on
 * wider cards, stacking below the legend on narrow ones) is sized so the
 * donut AND every outer badge fit inside it — no badge can ever be
 * clipped, and nothing can bleed into a neighbouring chart. The legend
 * sits beside the donut (below it on narrow screens), keeping the card
 * short so it matches the Trips chart's height. Slices sweep in on mount
 * / range change.
 *
 * ONE rotation clock, driven by a single requestAnimationFrame loop: the
 * angle is applied to the donut's wrapper AND (as the exact inverse) to
 * every badge pill's counter group in the same frame. Because the badge
 * layer lives INSIDE the rotating wrapper, each badge is attached to its
 * slice's exact mid-angle by construction — no separate orbit, no
 * desync, no drifting — while the counter-rotation keeps every pill
 * perfectly horizontal. The whole thing makes one very slow ambient
 * revolution (8 min per lap, runs always, off with reduced-motion), and
 * the angle is derived from wall-clock time, so even a backgrounded tab
 * snaps back to the correct position the moment it wakes. Slice colours
 * are bound to the slice's own name (stable gradient ids), never to its
 * array position, so a colour can never end up on the wrong slice when
 * the data order changes.
 *
 * EVERY slice always carries a white pop badge with its exact share,
 * outside the ring, its inner edge seated exactly on the ring's outer
 * side (zero gap) at the sector's exact mid-angle. Hovering a slice
 * lifts it out; the other slices stay fully solid (no fading). The centre
 * shows the total with a count-up, the legend lists every mode with exact
 * amount and share, and the card title links to the Collection Report.
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

  // Badge positions — the Pie's own layout (0° = 12 o'clock, clockwise, data
  // order), so each badge sits exactly at its slice's mid-angle.
  const sliceMids = useMemo(() => {
    const mids: number[] = [];
    let acc = 0;
    for (const d of enrichedData) {
      const span = total > 0 ? (d.value / total) * 360 : 0;
      mids.push(acc + span / 2);
      acc += span;
    }
    return mids;
  }, [enrichedData, total]);

  // recharts v3: the per-sector shape gets `isActive` for the hovered slice —
  // just lift it (bigger outer radius). The % badges live in a separate
  // overlay layer above the chart, so every one of them always renders.
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

  // ---- one rotation clock (rAF) -------------------------------------------
  // The donut wrapper rotates; every pill counter-group receives the exact
  // inverse rotation in the same frame — a single source of truth, so the
  // badges can never drift from their slices or tilt.
  const spinRef = useRef<HTMLDivElement | null>(null);
  const counterRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let running = false;

    const apply = (angle: number) => {
      if (spinRef.current) spinRef.current.style.transform = `rotate(${angle}deg)`;
      const inv = `rotate(${-angle}deg)`;
      for (const g of counterRefs.current) if (g) g.style.transform = inv;
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      if (spinRef.current) spinRef.current.style.transform = "";
      for (const g of counterRefs.current) if (g) g.style.transform = "";
    };

    const start = () => {
      if (running) return;
      running = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (!running) return;
        apply((((now - t0) / ORBIT_MS) * 360) % 360);
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
      {/* Compact row: the fixed 250 px donut stage sits beside the legend
          (stacks below it on narrow screens). The whole row is centred in
          whatever height the card gives it, so the card stays short. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 @md:flex-row">
        <div className="relative aspect-square w-full max-w-[240px] shrink-0" style={{ aspectRatio: "1 / 1" }}>
          {/* Soft background track behind the ring (same 74.24–107.5 band).
              SVG circle so it scales with the scene at every card width. */}
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="200" cy="200" r="91" fill="none" stroke="rgba(241,245,249,0.8)" strokeWidth="33" />
          </svg>

          {/* The rotating wrapper — the rAF loop sets its transform. The
              badge layer lives INSIDE it, so the badges are attached to
              their slices by construction. */}
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

            {/* White pop badges — one per slice, ALWAYS on. This layer sits
                inside the rotating wrapper, so each badge is permanently
                attached to its slice's exact mid-angle, outside the ring
                and seated on its outer side (zero gap). Each pill's
                counter group gets the inverse rotation from the same
                rAF clock, keeping it perfectly horizontal. */}
            <div className="pointer-events-none absolute inset-0">
              <svg viewBox="0 0 400 400" className="h-full w-full overflow-visible">
                <defs>
                  <filter id="cs-badge-shadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor="#0f172a" floodOpacity="0.22" />
                  </filter>
                </defs>
                {enrichedData.map((d, i) => {
                  if (d.percent < 4) return null;
                  const a = (sliceMids[i] * Math.PI) / 180;
                  // The pill (52×22) is seated so its inner edge sits EXACTLY
                  // on the ring's outer side (107.5) at ANY angle: the centre
                  // is pushed out by the pill's radial half-extent in this
                  // direction (support function) — zero gap at every angle.
                  const support = 26 * Math.abs(Math.sin(a)) + 11 * Math.abs(Math.cos(a));
                  const r = 107.5 + support;
                  const px = 200 + r * Math.sin(a);
                  const py = 200 - r * Math.cos(a);
                  return (
                    <g key={d.name}>
                      <g transform={`translate(${px.toFixed(2)}, ${py.toFixed(2)})`}>
                        <g
                          className="animate-pop-in"
                          style={{ transformBox: "view-box", transformOrigin: `${px.toFixed(2)}px ${py.toFixed(2)}px` }}
                        >
                          <g
                            className="cs-badge-counter"
                            ref={(el) => {
                              counterRefs.current[i] = el;
                            }}
                            style={{ transformBox: "view-box", transformOrigin: `${px.toFixed(2)}px ${py.toFixed(2)}px` }}
                          >
                            <rect
                              x={-26}
                              y={-11}
                              width={52}
                              height={22}
                              rx={11}
                              fill="#ffffff"
                              stroke="rgba(15,23,42,0.08)"
                              strokeWidth={1}
                              filter="url(#cs-badge-shadow)"
                            />
                            <text
                              x={0}
                              y={0.5}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={800}
                              fill="#1e293b"
                            >
                              {`${d.percent.toFixed(1)}%`}
                            </text>
                          </g>
                        </g>
                      </g>
                    </g>
                  );
                })}
              </svg>
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

      {/* Legend — every mode with exact amount and share, tight & staggered.
          Sits beside the donut on wider cards (inside the same flex row). */}
      <ul className="w-full min-w-0 space-y-1.5 @md:w-auto @md:flex-1">
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
              {`${d.percent.toFixed(1)}%`}
            </span>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
