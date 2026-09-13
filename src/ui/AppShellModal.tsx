/**
 * AppShellModal — global view, perfectly centered
 * - Exactly middle from total page including navigation/sidebar
 * - Header visible (starts below header)
 * - 10% blur only, blue tint minimal
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
    <div
      className="fixed flex items-center justify-center p-4"
      style={{
        zIndex,
        top: HEADER_H,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* 10% blur only — minimal, header visible below, blue tint */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{
          backgroundColor: "rgba(15,23,42,0.10)",
          backdropFilter: "blur(1px)",
        }}
        onMouseDown={(e) => {
          if (!closeOnOverlay) return;
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden="true"
      />

      {/* Perfectly centered, simple perfect fit, global view perfect */}
      <div
        className={`relative flex max-h-[calc(100vh-64px-2rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
        style={{
          zIndex: zIndex + 1,
          maxWidth: "min(96rem, calc(100vw - 2rem))",
          maxHeight: "min(calc(100vh - 64px - 2rem), 90vh)",
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
