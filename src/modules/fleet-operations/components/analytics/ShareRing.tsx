// src/modules/fleet-operations/components/analytics/ShareRing.tsx
// ---------------------------------------------------------------------------
// Small circular share indicator — the ring used by the dashboard's
// Collection Performance chart — shared by Cost Analysis and Fleet Insights
// so both cards present percentages exactly the same way.
// Animation classes live in src/index.css (.share-ring-progress).
// ---------------------------------------------------------------------------
import type { CSSProperties } from 'react';

interface ShareRingProps {
  /** Percentage 0–100 to display in the ring. */
  value: number;
  /** Stroke colour of the progress arc. */
  color: string;
  size?: number;
}

const ShareRing = ({ value, color, size = 56 }: ShareRingProps) => {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = 20.4;
  const strokeWidth = 4.1;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);
  const roundedPct = Math.round(pct);
  const isWidePercent = roundedPct >= 100;
  const numberFontSize = Math.max(12, Math.round(size * (isWidePercent ? 0.25 : 0.31) * 10) / 10);
  const percentFontSize = Math.max(8.5, Math.round(size * (isWidePercent ? 0.16 : 0.2) * 10) / 10);
  const progressStyle = {
    strokeDasharray: circumference,
    strokeDashoffset: dashOffset,
    '--share-ring-circumference': circumference,
    '--share-ring-dashoffset': dashOffset,
  } as CSSProperties;

  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-inset ring-slate-200/80"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap={pct >= 99.5 ? 'butt' : 'round'}
          className="share-ring-progress"
          style={progressStyle}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="relative flex max-w-[78%] items-center justify-center overflow-visible whitespace-nowrap font-black leading-none tabular-nums tracking-[-0.08em] text-slate-800">
        <span style={{ fontSize: numberFontSize, lineHeight: 1 }}>{roundedPct}</span>
        <span className="ml-px tracking-normal" style={{ fontSize: percentFontSize, lineHeight: 1 }}>
          %
        </span>
      </span>
    </span>
  );
};

export default ShareRing;
