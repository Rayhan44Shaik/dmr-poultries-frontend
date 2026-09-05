// src/ui/BrandMark.tsx
// Hen photo on a clean light badge. The source JPG has a black studio
// background — that is stripped once per session so the bird sits on the
// sidebar/login tile without a dark box.

import { useEffect, useState } from "react";
import henUrl from "../assets/dmr-hen.jpg";

export type BrandMarkSize = "xs" | "sm" | "md" | "lg" | "xl";
export type BrandMarkVariant = "tile" | "plain";
export type BrandMarkInset = "tight" | "normal" | "roomy";

export interface BrandMarkProps {
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
  inset?: BrandMarkInset;
  label?: string;
  className?: string;
}

const SIZES: Record<BrandMarkSize, { box: string; px: number }> = {
  xs: { box: "h-6 w-6 rounded-md", px: 24 },
  sm: { box: "h-8 w-8 rounded-lg", px: 32 },
  md: { box: "h-9 w-9 rounded-[10px]", px: 36 },
  lg: { box: "h-11 w-11 rounded-xl", px: 44 },
  xl: { box: "h-14 w-14 rounded-2xl", px: 56 },
};

const INSETS: Record<BrandMarkInset, number> = {
  tight: 0.04,
  normal: 0.08,
  roomy: 0.12,
};

const TILE =
  "bg-gradient-to-b from-white to-slate-50 " +
  "ring-1 ring-inset ring-slate-200/90 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.06)] " +
  "dark:from-slate-800 dark:to-slate-900 dark:ring-slate-700";

let cutoutPromise: Promise<string> | null = null;

function cutoutHen(): Promise<string> {
  if (cutoutPromise) return cutoutPromise;
  cutoutPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, width, height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
          if (luma < 28) {
            px[i + 3] = 0;
          } else if (luma < 48) {
            px[i + 3] = Math.round(((luma - 28) / 20) * 255);
          }
        }
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("hen"));
    image.src = henUrl;
  });
  cutoutPromise.catch(() => {
    cutoutPromise = null;
  });
  return cutoutPromise;
}

export default function BrandMark({
  size = "md",
  variant = "tile",
  inset = "normal",
  label,
  className = "",
}: BrandMarkProps) {
  const s = SIZES[size];
  const decorative = !label;
  const isTile = variant === "tile";
  const pad = isTile ? Math.max(1, Math.round(s.px * INSETS[inset])) : 0;
  const [src, setSrc] = useState(henUrl);

  useEffect(() => {
    let alive = true;
    void cutoutHen()
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className={[
        "relative shrink-0 select-none overflow-hidden",
        "flex items-center justify-center",
        s.box,
        isTile ? TILE : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ padding: pad || undefined }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <img
        src={src}
        width={s.px - pad * 2}
        height={s.px - pad * 2}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        decoding="async"
        className="h-full w-full object-contain object-center"
      />
    </div>
  );
}
