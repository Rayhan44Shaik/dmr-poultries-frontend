/**
 * PdfBlobPreview — dependency-free-looking PDF viewer for blob: URLs.
 *
 * Chrome blocks its built-in PDF plugin inside nested/sandboxed iframes
 * (e.g. when the app itself runs inside a preview iframe), which made the
 * Shop Ledger PDF modal render as a blank "blocked" frame. Rendering the
 * pages ourselves on a <canvas> with pdf.js sidesteps the plugin entirely
 * and shows the data in every browser.
 *
 * pdf.js is loaded lazily (dynamic import) so the main bundle is unaffected
 * and the worker + library are only fetched when a PDF preview opens.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from "lucide-react";
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from "pdfjs-dist";

type RenderTask = { promise: Promise<void>; cancel: () => void };

interface PdfBlobPreviewProps {
  /** Object URL of the PDF blob to display. */
  url: string;
}

const PdfBlobPreview: React.FC<PdfBlobPreviewProps> = ({ url }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [renderTick, setRenderTick] = useState(0);

  // ── Load the document (pdf.js is dynamically imported on first use) ──
  // The page mounts this component with key={url}, so state resets via
  // remount and the effect only needs to load the document itself.
  useEffect(() => {
    let cancelled = false;

    docRef.current = null;

    (async () => {
      try {
        // Legacy build: runs on every runtime we ship (browser + Electron's
        // older Chromium) while the browser bundle stays lazy-loaded.
        const [pdfjs, workerModule] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        docRef.current = pdf;
        setNumPages(pdf.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      docRef.current = null;
      void loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [url]);

  // ── Render the active page, fit to the panel width ──
  useEffect(() => {
    if (status !== "ready") return;
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!doc || !canvas || !wrap) return;

    let cancelled = false;

    (async () => {
      try {
        const page: PDFPageProxy = await doc.getPage(Math.min(Math.max(1, pageNum), doc.numPages));
        if (cancelled) return;

        const base: PageViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, wrap.clientWidth - 32);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (availableWidth / base.width) * dpr });

        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        renderTaskRef.current?.cancel();
        const task = page.render({ canvas, viewport }) as unknown as RenderTask;
        renderTaskRef.current = task;
        await task.promise;
      } catch {
        /* cancelled or superseded by a newer render — nothing to do */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pageNum, renderTick]);

  // Re-render when the panel is resized (debounced).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRenderTick((v) => v + 1), 150);
    });
    observer.observe(wrap);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [status]);

  const goPrev = useCallback(() => setPageNum((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(
    () => setPageNum((p) => Math.min(numPages || 1, p + 1)),
    [numPages],
  );

  if (status === "error") {
    // Fallback: still try the browser viewer, and point at the reliable actions.
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50/90 px-4 py-2 text-xs text-amber-800">
          <FileWarning size={15} className="mt-0.5 shrink-0" />
          <span>
            Inline preview is unavailable here. Use <b>Open in new tab</b> or <b>Download</b> below — the
            file itself is generated and ready.
          </span>
        </div>
        <iframe src={url} title="Shop Ledger PDF" className="min-h-0 w-full flex-1 border-0" />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="flex h-full min-w-0 flex-col">
      {status === "loading" && (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Rendering PDF preview…
        </div>
      )}

      {status === "ready" && (
        <>
          {numPages > 1 && (
            <div className="flex items-center justify-center gap-3 border-b border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageNum <= 1}
                aria-label="Previous page"
                className="rounded-md border border-slate-200 bg-white p-1 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Page {pageNum} of {numPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={pageNum >= numPages}
                aria-label="Next page"
                className="rounded-md border border-slate-200 bg-white p-1 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            <canvas
              ref={canvasRef}
              className="mx-auto block rounded-sm bg-white shadow-md ring-1 ring-slate-300/60"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PdfBlobPreview;
