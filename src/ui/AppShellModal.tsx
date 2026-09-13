/**
 * AppShellModal — global modal, perfectly centered on TOTAL page
 * including navigation/sidebar, 30% blur background only.
 *
 * - Fixed inset-0 covering entire viewport (sidebar + header included)
 * - Overlay: 30% only — bg-slate-900/30 (blueish dark) + backdrop-blur
 * - Panel: perfectly middle from all sides, simple perfect fit
 * - Rounded-2xl, shadow-2xl, border, centered with p-4 gaps
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ zIndex }}>
      {/* 30% blur background only — blue tint, total page */}
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] animate-fade-in"
        style={{ backgroundColor: "rgba(15,23,42,0.3)" }}
        onMouseDown={(e) => {
          if (!closeOnOverlay) return;
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden="true"
      />

      {/* Perfectly centered, simple perfect fit */}
      <div
        className={`relative flex max-h-[calc(100vh-2rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
        style={{
          zIndex: zIndex + 1,
          // Simple perfect fit: centered with equal gaps from all sides
          maxWidth: "min(96rem, calc(100vw - 2rem))",
          maxHeight: "min(calc(100vh - 2rem), 92vh)",
        }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;

  return createPortal(content, document.body);
}
