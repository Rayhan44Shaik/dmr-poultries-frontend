/**
 * AppShellModal — global modal that respects the app shell
 * (header + sidebar) with neat gaps, as requested for Trip List / Rate Entry view.
 *
 * - 30% blur background only (bg-black/30)
 * - Perfectly centered in the content area (after header + sidebar)
 * - Size perfect: centered from all sides with equal gaps
 * - Rounded-2xl, shadow-2xl, border
 *
 * On mobile (<1024px) sidebar is overlay, so left = 0.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SIDEBAR_STORAGE_KEY, SIDEBAR_WIDTH, type SidebarMode, isValidSidebarMode } from "./Sidebar/sidebarMode";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  closeOnOverlay?: boolean;
  zIndex?: number;
};

const LG_QUERY = "(min-width: 1024px)";
const GAP = 16;
const HEADER_H = 64; // h-16

function getStoredSidebarMode(): SidebarMode {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return "expanded";
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // plain string
    }
    if (typeof parsed === "string" && isValidSidebarMode(parsed)) return parsed;
    if (isValidSidebarMode(raw)) return raw as SidebarMode;
  } catch {
    // ignore
  }
  return "expanded";
}

function useSidebarWidth(): number {
  const [mode, setMode] = useState<SidebarMode>(() => {
    if (typeof window === "undefined") return "expanded";
    return getStoredSidebarMode();
  });
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(LG_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(LG_QUERY);
    const onMql = () => setIsDesktop(mql.matches);
    onMql();
    mql.addEventListener?.("change", onMql);

    const onStorage = () => setMode(getStoredSidebarMode());
    const onCustom = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail && isValidSidebarMode(custom.detail)) setMode(custom.detail);
      else setMode(getStoredSidebarMode());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("dmr-sidebar-mode-change", onCustom as EventListener);
    const interval = window.setInterval(() => {
      const current = getStoredSidebarMode();
      setMode((prev) => (prev !== current ? current : prev));
    }, 500);

    return () => {
      mql.removeEventListener?.("change", onMql);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dmr-sidebar-mode-change", onCustom as EventListener);
      clearInterval(interval);
    };
  }, []);

  return useMemo(() => {
    if (!isDesktop) return 0;
    return SIDEBAR_WIDTH[mode] ?? 260;
  }, [mode, isDesktop]);
}

export default function AppShellModal({ open, onClose, children, panelClassName = "", closeOnOverlay = true, zIndex = 50 }: Props) {
  const sidebarWidth = useSidebarWidth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Content area after header + sidebar — modal is perfectly centered inside it
  // with equal gaps (p-4) from all sides.
  const shellContainer = (
    <div
      className="fixed flex items-center justify-center p-4"
      style={{
        zIndex,
        top: HEADER_H,
        left: sidebarWidth,
        right: 0,
        bottom: 0,
        // Smooth transition when sidebar toggles
        transition: "left 0.3s ease-out",
      }}
    >
      {/* 30% blur background only, not 100% */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-fade-in"
        onMouseDown={(e) => {
          if (!closeOnOverlay) return;
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden="true"
      />

      {/* Perfectly centered panel with equal gaps from all sides */}
      <div
        className={`relative flex max-h-[calc(100%-0px)] max-w-[calc(100%-0px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in dark:border-slate-700 dark:bg-slate-900 ${panelClassName}`}
        style={{
          zIndex: zIndex + 1,
          width: "100%",
          // Size perfect: max 96rem width, but always centered with gaps
          maxWidth: "min(96rem, calc(100vw - var(--sidebar-w) - 2rem))" as any,
          maxHeight: "calc(100vh - 64px - 2rem)", // header + 2*GAP
          // For lg, ensure it doesn't exceed content width
          // Use inline var for transition
        }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );

  // Wrapper for CSS var to compute max-width dynamically
  const wrapper = (
    <div style={{ ["--sidebar-w" as any]: `${sidebarWidth}px` } as React.CSSProperties}>
      {shellContainer}
    </div>
  );

  if (typeof document === "undefined") return wrapper;

  return createPortal(wrapper, document.body);
}
