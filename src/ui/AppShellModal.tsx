/**
 * AppShellModal — global view, perfectly centered
 * - Blur header as well when open (overlay covers total page)
 * - View starts below header (panel top = header height + gap)
 * - 5% blur only, blue tint minimal
 * - Exactly middle from total page including navigation/sidebar
 * - Simple perfect fit, global for all pages
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  closeOnOverlay?: boolean;
  zIndex?: number;
};

const HEADER_H = 64;
const GAP = 16;

export default function AppShellModal({ open, onClose, children, panelClassName = "", closeOnOverlay = true, zIndex = 50 }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <>
      {/* Overlay — blurs header as well, 5% only */}
      <div
        className="fixed inset-0 animate-fade-in"
        style={{
          zIndex,
          backgroundColor: "rgba(15,23,42,0.05)",
          backdropFilter: "blur(2px)",
        }}
        onMouseDown={(e) => {
          if (!closeOnOverlay) return;
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden="true"
      />

      {/* Panel wrapper — starts below header, total page centered including sidebar */}
      <div
        className="fixed flex items-center justify-center p-4"
        style={{
          zIndex: zIndex + 1,
          top: HEADER_H + GAP,
          left: GAP,
          right: GAP,
          bottom: GAP,
        }}
      >
        <div
          className={`relative flex w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
          style={{
            maxWidth: "min(96rem, calc(100vw - 2rem))",
            maxHeight: "calc(100vh - 64px - 2rem)",
            width: "100%",
          }}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return content;

  return createPortal(content, document.body);
}
