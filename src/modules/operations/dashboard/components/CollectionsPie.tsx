import { useMemo, useState } from "react";
import { useI18n } from "../../../../i18n";
import { formatINRCompact } from "../../../../utils/format";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

/* ------------------------------------------------------------------ *
 * 3D pie geometry — fixed viewBox stage (pure SVG, no chart library).
 *
 * The pie is an ellipse (top face) extruded straight down by DEPTH,
 * like a classic infographic 3D pie: a gradient top face, darker
 * extruded side walls on the front (lower) half, a soft ground
 * shadow, and a big colour-matched % label floating outside every
 * slice at its own mid-angle.
 * ------------------------------------------------------------------ */
const W = 480;
const H = 330;
const CX = W / 2;
const CY = 139; // top-face centre
const RX = 148; // top-face horizontal radius
const RY = 66; // top-face vertical radius (flattened = perspective)
const DEPTH = 52; // vertical extrusion
const GAP_DEG = 3.5; // angular gap between slices
const LABEL_GAP = 14; // label distance outside the pie edge

const rad = (deg: number) => (deg * Math.PI) / 180;
const f = (n: number) => n.toFixed(2);

/** amt in [-1, 1]: negative darkens toward black, positive lightens toward white. */
function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const mix = (v: number) => Math.round(v + (target - v) * p);
  return `rgb(${mix(c[0])}, ${mix(c[1])}, ${mix(c[2])})`;
}

/** Point on the top-face ellipse at angle `deg` (0 = 3 o'clock, clockwise). */
function ellPoint(deg: number, dy = 0) {
  return { x: CX + RX * Math.cos(rad(deg)), y: CY + RY * Math.sin(rad(deg)) + dy };
}

/** Top-face sector path (a full 100% slice is split into two arcs). */
function topFacePath(a0: number, a1: number): string {
  const s = ellPoint(a0);
  if (a1 - a0 >= 359.9) {
    const m = ellPoint(a0 + 180);
    return `M ${f(CX)} ${f(CY)} L ${f(s.x)} ${f(s.y)} A ${RX} ${RY} 0 1 1 ${f(m.x)} ${f(m.y)} A ${RX} ${RY} 0 1 1 ${f(s.x)} ${f(s.y)} Z`;
  }
  const e = ellPoint(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${f(CX)} ${f(CY)} L ${f(s.x)} ${f(s.y)} A ${RX} ${RY} 0 ${large} 1 ${f(e.x)} ${f(e.y)} Z`;
}

/** Extruded side wall for the front (lower-half) part of the slice's outer arc. */
function wallPath(a0: number, a1: number): string | null {
  const vs = Math.max(a0, 0);
  const ve = Math.min(a1, 180);
  if (ve - vs < 0.5) return null;
  const t0 = ellPoint(vs);
  const t1 = ellPoint(ve);
  const b1 = ellPoint(ve, DEPTH);
  const b0 = ellPoint(vs, DEPTH);
  const large = ve - vs > 180 ? 1 : 0;
  return (
    `M ${f(t0.x)} ${f(t0.y)} A ${RX} ${RY} 0 ${large} 1 ${f(t1.x)} ${f(t1.y)} ` +
    `L ${f(b1.x)} ${f(b1.y)} A ${RX} ${RY} 0 ${large} 0 ${f(b0.x)} ${f(b0.y)} Z`
  );
}

/** Big % label position — just outside the slice's mid-angle edge. */
function labelPoint(mid: number) {
  const below = Math.sin(rad(mid)) > 0;
  return {
    x: CX + (RX + LABEL_GAP) * Math.cos(rad(mid)),
    y: CY + (RY + (below ? DEPTH : 0) + LABEL_GAP) * Math.sin(rad(mid)),
  };
}

/** Hover "explode": push the slice outward along its mid-angle and lift it. */
function liftTransform(mid: number) {
  const dx = 9 * Math.cos(rad(mid));
  const dy = 9 * Math.sin(rad(mid)) - 12;
  return `translate(${f(dx)}px, ${f(dy)}px)`;
}

const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

interface CollectionsPieProps {
  data: { name: string; value: number }[];
}

interface Slice {
  name: string;
  value: number;
  percent: number;
  color: string;
  a0: number;
  a1: number;
  mid: number;
}

/**
 * Collection Streams — payment-mode 3D pie for the Operations dashboard.
 *
 * A solid extruded 3D pie (top face + front side walls + ground shadow)
 * with a large colour-matched % label floating outside every slice at its
 * own mid-angle. Hovering a slice lifts it outward, grows its label, and
 * dims the rest. The legend below lists every mode with exact amount and
 * share; the card title links to the Collection Report.
 */
export default function CollectionsPie({ data }: CollectionsPieProps) {
  const { t } = useI18n();
  const [hoverIndex, setHoverIndex] = useState(-1);
  const chartData = useMemo(() => data ?? [], [data]);

  const slices = useMemo<Slice[]>(() => {
    const total = chartData.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    if (total <= 0) return [];
    let angle = -90; // start at 12 o'clock, sweep clockwise
    return chartData.map((d, i) => {
      const value = Number(d.value) || 0;
      const span = (value / total) * 360;
      const a0 = angle;
      const a1 = angle + span;
      angle = a1;
      return {
        name: d.name,
        value,
        percent: (value / total) * 100,
        color: COLORS[i % COLORS.length],
        a0,
        a1,
        mid: (a0 + a1) / 2,
      };
    });
  }, [chartData]);

  // Back-to-front paint order (by the slice mid-angle's screen y).
  const drawOrder = useMemo(
    () =>
      slices
        .map((s, i) => ({ s, i }))
        .sort((a, b) => Math.sin(rad(a.s.mid)) - Math.sin(rad(b.s.mid))),
    [slices]
  );

  if (slices.length === 0) {
    return (
      <div className="flex w-full min-w-0 flex-1 items-center justify-center py-10 text-center text-sm text-slate-400">
        {t("empty.no_data")}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      {/* 3D pie — fixed viewBox stage, generous white space on all sides. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[450px]"
          role="img"
          aria-label={`Collection streams: ${slices.map((s) => `${s.name} ${Math.round(s.percent)}%`).join(", ")}`}
        >
          <defs>
            {slices.map((s, i) => (
              <g key={s.name}>
                <linearGradient
                  id={`cs3d-top-${i}`}
                  gradientUnits="userSpaceOnUse"
                  x1={CX}
                  y1={CY - RY}
                  x2={CX}
                  y2={CY + RY}
                >
                  <stop offset="0%" stopColor={shade(s.color, 0.24)} />
                  <stop offset="100%" stopColor={s.color} />
                </linearGradient>
                <linearGradient
                  id={`cs3d-wall-${i}`}
                  gradientUnits="userSpaceOnUse"
                  x1={CX}
                  y1={CY + 8}
                  x2={CX}
                  y2={CY + RY + DEPTH}
                >
                  <stop offset="0%" stopColor={shade(s.color, -0.16)} />
                  <stop offset="100%" stopColor={shade(s.color, -0.36)} />
                </linearGradient>
              </g>
            ))}
          </defs>

          {/* Soft ground shadow under the pie. */}
          <ellipse cx={CX} cy={CY + RY + DEPTH + 7} rx={RX * 0.99} ry={13} fill="rgba(15,23,42,0.07)" />

          {/* Slices, back to front: side wall + gradient top face. */}
          {drawOrder.map(({ s, i }) => {
            const dimmed = hoverIndex !== -1 && hoverIndex !== i;
            const gA0 = s.a0 + GAP_DEG / 2;
            const gA1 = Math.max(s.a1 - GAP_DEG / 2, gA0 + 0.4);
            const wall = wallPath(gA0, gA1);
            return (
              <g
                key={s.name}
                style={{
                  opacity: dimmed ? 0.4 : 1,
                  transform: hoverIndex === i ? liftTransform(s.mid) : "translate(0px, 0px)",
                  transition: `opacity 200ms ease, transform 300ms ${SPRING}`,
                }}
              >
                {wall && <path d={wall} fill={`url(#cs3d-wall-${i})`} />}
                <path
                  d={topFacePath(gA0, gA1)}
                  fill={`url(#cs3d-top-${i})`}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={1}
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Big colour-matched % labels, floating outside each slice. */}
          {slices.map((s, i) => {
            if (s.percent < 4) return null;
            const p = labelPoint(s.mid);
            const active = hoverIndex === i;
            return (
              <g
                key={s.name}
                pointerEvents="none"
                style={{
                  transform: active ? liftTransform(s.mid) : "translate(0px, 0px)",
                  transition: `transform 300ms ${SPRING}`,
                }}
              >
                <text
                  x={f(p.x)}
                  y={f(p.y)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={active ? 30 : 27}
                  fontWeight={800}
                  fill={s.color}
                  style={{ transition: "font-size 200ms ease" }}
                >
                  {Math.round(s.percent)}%
                </text>
              </g>
            );
          })}

          {/* Stable hover targets (full, gap-free top faces) — above everything. */}
          <g onMouseLeave={() => setHoverIndex(-1)}>
            {slices.map((s, i) => (
              <path
                key={s.name}
                d={topFacePath(s.a0, s.a1)}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIndex(i)}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Legend — numbered, every mode with exact amount and share. */}
      <ul className="mt-1 w-full flex-shrink-0 space-y-1 border-t border-slate-100 pt-3">
        {slices.map((s, i) => (
          <li
            key={s.name}
            className="flex animate-fade-in-up items-center gap-2"
            style={{ animationDelay: `${180 + i * 90}ms` }}
          >
            <span className="w-5 flex-shrink-0 text-[10px] font-black tabular-nums" style={{ color: s.color }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="truncate text-[12px] font-semibold text-slate-600">{s.name}</span>
            <span className="ml-auto text-[12px] font-bold tabular-nums text-slate-700">
              {formatINRCompact(s.value)}
            </span>
            <span className="w-11 flex-shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400">
              {s.percent.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
