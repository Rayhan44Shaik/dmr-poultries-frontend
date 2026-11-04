import { useCallback, useEffect, useRef, useState } from "react";
import { DragScrollTracker } from "../utils/mortalityLoads";

/**
 * Smooth horizontal side-drag scrolling for a wide table scroller.
 *
 * Press-and-drag on a safe (non-interactive) area scrolls left/right; a plain
 * click still reaches the row, sort buttons, tooltip triggers and links
 * untouched. Touch pointers are ignored entirely so native touch scrolling
 * and pull gestures keep working.
 *
 * Contract:
 *   - Pointer Events with pointer capture during an armed/dragging gesture.
 *   - A small movement threshold separates a click from a drag; only a real
 *     drag suppresses the click (capture-phase, so row expansion, sorting and
 *     tooltip triggers never fire from a drag).
 *   - Interactive descendants (buttons, inputs, links, tooltip triggers, the
 *     expanded panel) never arm a drag — see DRAG_GUARD_SELECTOR.
 *   - Vertical page scrolling, wheel/trackpad scrolling and the visible
 *     scrollbar are all preserved; only scrollLeft is ever written.
 *   - No document-level listeners; everything detaches with the scroller.
 */
export function useDragScroll<T extends HTMLElement>() {
  const scrollerRef = useRef<T | null>(null);
  const trackerRef = useRef<DragScrollTracker | null>(null);
  const suppressClickRef = useRef(false);
  /** Shared with cells so a tooltip never opens mid-drag. */
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  if (trackerRef.current === null) trackerRef.current = new DragScrollTracker();

  // A drag that outlives the gesture (pointer captured elsewhere, unmount
  // mid-drag) must never leave a stale click suppressor behind.
  useEffect(
    () => () => {
      trackerRef.current?.cancel();
      suppressClickRef.current = false;
    },
    []
  );

  const setRef = useCallback((element: T | null) => {
    if (trackerRef.current?.active) {
      trackerRef.current.cancel();
      suppressClickRef.current = false;
      draggingRef.current = false;
      setDragging(false);
    }
    scrollerRef.current = element;
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<T>) => {
    // Touch keeps its native scroll; non-primary buttons keep their behaviour.
    if (event.pointerType === "touch" || (event.button !== 0 && event.pointerType === "mouse")) return;
    const tracker = trackerRef.current;
    if (!tracker || !tracker.down(event.clientX, event.clientY, event.target)) return;
    // Steal the gesture so text selection never starts on the safe area; row
    // clicks re-focus the row themselves in their own click handler.
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A scroller that cannot capture still drags — moves keep arriving.
    }
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const tracker = trackerRef.current;
    const scroller = scrollerRef.current;
    if (!tracker || !scroller || !tracker.active) return;
    const dx = tracker.move(event.clientX, event.clientY);
    if (dx !== 0) {
      if (!draggingRef.current) {
        draggingRef.current = true;
        setDragging(true);
      }
      scroller.scrollLeft -= dx;
    }
  }, []);

  const endGesture = useCallback((event: React.PointerEvent<T>) => {
    const tracker = trackerRef.current;
    if (!tracker || !tracker.active) return;
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture was never taken — nothing to release.
    }
    suppressClickRef.current = tracker.up();
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const onPointerUp = endGesture;
  const onPointerCancel = endGesture;

  const onLostPointerCapture = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker || !tracker.active) return;
    suppressClickRef.current = tracker.up();
    draggingRef.current = false;
    setDragging(false);
  }, []);

  // Capture phase: a real drag dies here, before row expansion, sorting or
  // tooltip triggers ever see it. A plain click passes straight through.
  const onClickCapture = useCallback((event: React.MouseEvent<T>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    /** Attach to the scrolling container. */
    scrollerRef: setRef,
    /** True while a real drag is in flight (grabbing cursor). */
    dragging,
    /** Cells check this before opening a tooltip. */
    draggingRef,
    scrollerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
      onClickCapture,
    },
  };
}
