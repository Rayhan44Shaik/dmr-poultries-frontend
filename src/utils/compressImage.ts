// src/utils/compressImage.ts
//
// Client-side photo auto-compression for uploads (Trip Entry DC photos,
// diesel bills). Goal: every stored image lands under the byte budget
// (default: 100 KB as stored — the base64 data-URL length is what persists
// to the database) while staying visually CLEAR:
//
//   1. Quality first — downscale only to a sane max dimension (1600px keeps
//      weighbridge slips / receipts perfectly readable), then step JPEG
//      quality down from 0.85. Small quality steps are visually invisible;
//      aggressive downscaling is what makes photos look bad.
//   2. Shrink dimensions only as a last resort (never below 640px on the
//      long side, where slips stop being legible).
//   3. Images already under the budget are returned untouched — zero
//      recompression, zero quality loss.
//
// Any failure (unsupported codec like HEIC, canvas taint, decode errors)
// falls back to the original data URL so an upload is never lost.

export interface CompressImageResult {
  /** Ready-to-store data URL (image/jpeg when recompressed). */
  dataUrl: string;
  /** MIME of `dataUrl` — "image/jpeg" after recompression. */
  mime: string;
  /** Pixel dimensions of the stored image. */
  width: number;
  height: number;
  /** Original file size in bytes. */
  originalBytes: number;
  /** Stored size in bytes ≈ (dataUrl.length - header) base64-decoded. */
  storedBytes: number;
  /** false = original passed through untouched (already small enough). */
  compressed: boolean;
}

export interface CompressImageOptions {
  /** Max stored size in bytes (data-URL payload). Default 100 KB. */
  maxBytes?: number;
  /** Max long-edge pixels before any quality step. Default 1600. */
  maxDimension?: number;
  /** Hard floor for the long edge — below this slips become unreadable. */
  minDimension?: number;
  /** Optimise photographed paperwork for legible text at very small sizes. */
  documentMode?: boolean;
}

/** Default: keep the PERSISTED (base64) size ≤ 100 KB. */
export const DEFAULT_IMAGE_MAX_BYTES = 100 * 1024;

// A short descending search is intentionally used here. The old eleven-step
// search could encode the same multi-megapixel canvas dozens of times.
const QUALITY_STEPS = [0.86, 0.7, 0.54, 0.4, 0.32];

async function decodeImage(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image_decode_failed"));
      img.src = objectUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function sourceSize(source: HTMLImageElement | ImageBitmap): { w: number; h: number } {
  if ("naturalWidth" in source) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  return { w: source.width, h: source.height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("blob_read_failed"));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Canvas.toDataURL performs image encoding synchronously on the browser's UI
 * thread. Large phone photos can therefore make the whole application appear
 * hung while the quality search runs. toBlob schedules the encode
 * asynchronously and gives Chromium opportunities to paint/respond.
 */
function drawToCanvas(
  source: HTMLImageElement | ImageBitmap,
  width: number,
  height: number,
  documentMode: boolean
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  // White backdrop keeps transparent PNGs solid instead of turning black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (documentMode) ctx.filter = "grayscale(1) contrast(1.18) brightness(1.04)";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (encoded) => encoded ? resolve(encoded) : reject(new Error("image_encode_failed")),
      mime,
      quality,
    );
  });
}

/** Base64-decoded byte size of a data URL (what the DB actually stores). */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Compress an image file to stay under `maxBytes` while keeping it clear.
 * Returns the (possibly untouched) data URL plus size metadata.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressImageResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_IMAGE_MAX_BYTES;
  const maxDimension = options.maxDimension ?? 1600;
  const minDimension = options.minDimension ?? 640;
  const documentMode = options.documentMode ?? false;

  const passthrough = async (note: { w?: number; h?: number } = {}): Promise<CompressImageResult> => {
    const originalDataUrl = await fileToDataUrl(file);
    return {
      dataUrl: originalDataUrl,
      mime: file.type || "image/png",
      width: note.w ?? 0,
      height: note.h ?? 0,
      originalBytes: file.size,
      storedBytes: dataUrlBytes(originalDataUrl),
      compressed: false,
    };
  };

  // Already small enough → store as-is (best possible quality: untouched).
  if (file.size <= maxBytes) {
    try {
      const source = await decodeImage(file);
      const { w, h } = sourceSize(source);
      if ("close" in source) source.close();
      return await passthrough({ w, h });
    } catch {
      return await passthrough();
    }
  }

  let source: HTMLImageElement | ImageBitmap;
  try {
    source = await decodeImage(file);
  } catch {
    // Undecodable by the browser (e.g. HEIC) → keep the original upload.
    return await passthrough();
  }

  const { w: naturalW, h: naturalH } = sourceSize(source);
  if (!naturalW || !naturalH) {
    if ("close" in source) source.close();
    return await passthrough({ w: naturalW, h: naturalH });
  }

  let scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
  let bestBlob: Blob | null = null;
  let bestW = naturalW;
  let bestH = naturalH;

  try {
    for (;;) {
      const width = Math.max(1, Math.round(naturalW * scale));
      const height = Math.max(1, Math.round(naturalH * scale));
      const canvas = drawToCanvas(source, width, height, documentMode);
      try {
        // WebP is substantially smaller for document photos. Fall back to
        // JPEG only when the browser does not actually support WebP.
        for (const requestedMime of ["image/webp", "image/jpeg"] as const) {
          let formatSupported = false;
          for (const quality of QUALITY_STEPS) {
            const blob = await encodeCanvas(canvas, requestedMime, quality);
            if (requestedMime === "image/webp" && blob.type !== requestedMime) break;
            formatSupported = true;
            if (!bestBlob || blob.size < bestBlob.size) {
              bestBlob = blob;
              bestW = width;
              bestH = height;
            }
            if (blob.size <= maxBytes) {
              return {
                dataUrl: await blobToDataUrl(blob),
                mime: blob.type || requestedMime,
                width,
                height,
                originalBytes: file.size,
                storedBytes: blob.size,
                compressed: true,
              };
            }
          }
          if (formatSupported) break;
        }
      } finally {
        // Release the potentially large backing buffer before resizing.
        canvas.width = 1;
        canvas.height = 1;
      }
      // Still over budget at the lowest quality → shrink and try again.
      // The only stop is the legibility floor: never go below `minDimension`
      // on the long edge (slips/receipts stay readable at 640px+).
      if (Math.max(width, height) <= minDimension) {
        // Floor reached: return the smallest/clearest version we achieved.
        if (!bestBlob) return await passthrough({ w: naturalW, h: naturalH });
        return {
          dataUrl: await blobToDataUrl(bestBlob),
          mime: bestBlob.type || "image/jpeg",
          width: bestW,
          height: bestH,
          originalBytes: file.size,
          storedBytes: bestBlob.size,
          compressed: true,
        };
      }
      // Jump toward the required byte area instead of shrinking by a fixed
      // 15% and repeating many near-identical encodes.
      const byteRatio = bestBlob ? maxBytes / bestBlob.size : 0.5;
      const shrink = Math.max(0.68, Math.min(0.84, Math.sqrt(byteRatio) * 0.94));
      const floorScale = minDimension / Math.max(naturalW, naturalH);
      scale = Math.max(floorScale, scale * shrink);
    }
  } finally {
    if ("close" in source) source.close();
  }
}
