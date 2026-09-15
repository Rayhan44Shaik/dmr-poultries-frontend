// src/modules/staff/components/salary/usePopupGuard.ts
//
// Top-layer guard for the Email / WhatsApp payslip popups, which open ABOVE
// the Review & Submit popup:
//
//  1. Scroll lock — the app shell is h-screen overflow-hidden with an inner
//     #app-scroll scroller; both it and the document are frozen while the
//     popup is open so the background page cannot scroll, and everything is
//     restored when the popup closes.
//  2. Key guard (window CAPTURE phase, so it runs before the Review popup's
//     bubble-phase listeners): ArrowUp/ArrowDown are swallowed so the Review
//     list behind never navigates, and Escape closes ONLY this popup.

import { useEffect, useRef } from "react";

export function usePopupGuard(onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    const prevDoc = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    const prevApp = scroller?.style.overflow ?? "";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scroller) scroller.style.overflow = "hidden";

    const guard = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        // Review-popup list navigation must not run behind this popup.
        event.stopPropagation();
      } else if (event.key === "Escape") {
        // Close only the top popup — the Review popup's own Escape listener
        // (bubble phase) never sees this event.
        event.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", guard, true);
    return () => {
      window.removeEventListener("keydown", guard, true);
      document.documentElement.style.overflow = prevDoc;
      document.body.style.overflow = prevBody;
      if (scroller) scroller.style.overflow = prevApp;
    };
  }, []);
}

export default usePopupGuard;
