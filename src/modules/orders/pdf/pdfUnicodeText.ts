// Render Unicode (Telugu) labels as PNG for jsPDF, which cannot paint
// Indic scripts with Helvetica. Uses the browser canvas + a web font.

import type { jsPDF } from "jspdf";

const TELUGU_RE = /[\u0C00-\u0C7F]/;
const FONT_FAMILY = '"Noto Sans Telugu", "Noto Sans", sans-serif';
const PX_PER_MM = 8;

let fontReady: Promise<void> | null = null;

export function hasTelugu(text: string): boolean {
  return TELUGU_RE.test(text);
}

export function ensureTeluguWebFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontReady) return fontReady;
  fontReady = (async () => {
    // Noto Sans Telugu is bundled locally from @fontsource in src/index.css.
    // Wait for those declared faces instead of injecting a Google Fonts link.
    const wait = async () => {
      try {
        await document.fonts.ready;
        await document.fonts.load(`700 24px ${FONT_FAMILY}`);
      } catch {
        /* Nirmala / Lohit still cover Telugu on most desktops */
      }
    };
    await Promise.race([wait(), new Promise<void>((r) => setTimeout(r, 1800))]);
  })();
  return fontReady;
}

export type UnicodeTextAlign = "left" | "center" | "right";

export function addUnicodeText(
  doc: jsPDF,
  text: string,
  xMm: number,
  yMm: number,
  opts: {
    fontSizeMm?: number;
    color?: string;
    bold?: boolean;
    align?: UnicodeTextAlign;
    maxWidthMm?: number;
    baseline?: "alphabetic" | "middle";
  } = {}
): void {
  if (!text) return;
  if (!hasTelugu(text)) {
    const size = (opts.fontSizeMm ?? 3) * 2.8346; // mm → pt-ish for setFontSize
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(Math.max(7, size));
    const align = opts.align ?? "left";
    doc.text(text, xMm, yMm, { align });
    return;
  }

  const fontSizeMm = opts.fontSizeMm ?? 3.2;
  const px = fontSizeMm * PX_PER_MM;
  const maxW = (opts.maxWidthMm ?? 80) * PX_PER_MM;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.font = `${opts.bold ? 700 : 400} ${px}px ${FONT_FAMILY}`;
  const metrics = ctx.measureText(text);
  const widthPx = Math.min(maxW, Math.ceil(metrics.width) + 4);
  const heightPx = Math.ceil(px * 1.45);
  canvas.width = Math.max(1, widthPx);
  canvas.height = Math.max(1, heightPx);
  ctx.font = `${opts.bold ? 700 : 400} ${px}px ${FONT_FAMILY}`;
  ctx.fillStyle = opts.color ?? "#0f234f";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 2, heightPx / 2, maxW);

  const wMm = canvas.width / PX_PER_MM;
  const hMm = canvas.height / PX_PER_MM;
  const align = opts.align ?? "left";
  let drawX = xMm;
  if (align === "center") drawX = xMm - wMm / 2;
  if (align === "right") drawX = xMm - wMm;
  const drawY = (opts.baseline ?? "alphabetic") === "middle" ? yMm - hMm / 2 : yMm - hMm * 0.78;
  try {
    doc.addImage(canvas.toDataURL("image/png"), "PNG", drawX, drawY, wMm, hMm, undefined, "FAST");
  } catch {
    // Ignore a failed overlay — Latin fallback already painted by autoTable.
  }
}
