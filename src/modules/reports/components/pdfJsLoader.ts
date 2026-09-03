/**
 * Lazy loader for the pdf.js viewer used by PdfBlobPreview.
 *
 * The library (~500KB) + worker (~1.3MB) are fetched on demand. The cached
 * promises here let callers warm them during idle time (or while PDFs are
 * still generating) so the first preview paints without a network wait.
 */

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsModulePromise: Promise<PdfJsModule> | null = null;
let workerUrlPromise: Promise<{ default: string }> | null = null;

/** Start (or join) the prefetch of the pdf.js library + worker URL. */
export const prefetchPdfJs = (): void => {
  pdfjsModulePromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  workerUrlPromise ??= import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
};

/** Await the warmed pdf.js module and worker URL (starts them if needed). */
export const loadPdfJs = (): Promise<[PdfJsModule, { default: string }]> => {
  prefetchPdfJs();
  return Promise.all([
    pdfjsModulePromise as Promise<PdfJsModule>,
    workerUrlPromise as Promise<{ default: string }>,
  ]);
};
