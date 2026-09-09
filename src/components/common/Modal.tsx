/**
 * =============================================================================
 * COMPATIBILITY ADAPTER → the canonical dialog in `src/ui/Modal`
 * =============================================================================
 * This file used to hold a SECOND, weaker dialog implementation: no Escape
 * handling, no `aria-modal`, no focus trap, no focus restoration, no scroll
 * containment, and a different radius / shadow / title scale from
 * `src/ui/Modal`. Two dialog systems is exactly the duplication the design
 * system exists to remove.
 *
 * It is now a thin adapter: this import path keeps working, while every dialog
 * in the app shares one implementation and one behaviour. The legacy `open` and
 * `width` props are preserved; `footer` is additive.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { Modal as Dialog } from "../../ui/Modal";

interface Props {
  open: boolean;
  title: string;
  /** Legacy raw max-width class, e.g. `"max-w-3xl"`. */
  width?: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional sticky action row (additive). */
  footer?: ReactNode;
}

export default function Modal({ open, title, width = "max-w-3xl", onClose, children, footer }: Props) {
  return (
    <Dialog isOpen={open} onClose={onClose} title={title} width={width} footer={footer}>
      {children}
    </Dialog>
  );
}
