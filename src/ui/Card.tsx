/**
 * =============================================================================
 * GLOBAL CARD / SURFACE
 * =============================================================================
 * One card style for the whole app: surface radius, hairline border and the
 * restrained `shadow-card` elevation. Previously modules mixed `rounded-xl`,
 * `rounded-2xl`, `shadow-sm`, `shadow-lg`, `shadow-xl` and `shadow-2xl`, so
 * every panel looked like a separate floating object.
 *
 * Sub-composition (Header / Title / Body / Footer) is exported too, so a card's
 * internal padding and divider placement are consistent without each page
 * re-declaring them.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import {
  uiCardBodyClass,
  uiCardClass,
  uiCardFooterClass,
  uiCardHeaderClass,
  uiCardSubtitleClass,
  uiCardTitleClass,
  uiPanelSunkenClass,
} from "../shared/ui/uiTokens";

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Softly animate the card in. Off by default: animating every card on a
   *  data-dense page is noise, and it must never delay interaction. */
  animate?: boolean;
  /** Removes padding so a table can sit flush inside the card. */
  flush?: boolean;
  /** Sunken secondary surface (KPI strips, inset panels). */
  sunken?: boolean;
  as?: "div" | "section" | "article" | "aside";
}

export function Card({
  children,
  className = "",
  animate = false,
  flush = false,
  sunken = false,
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={cn(
        sunken ? uiPanelSunkenClass : uiCardClass,
        animate && "animate-fade-in-up",
        flush ? "overflow-hidden" : "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn(uiCardHeaderClass, className)}>
      <div className="min-w-0 flex-1">
        {title ? <h3 className={uiCardTitleClass}>{title}</h3> : null}
        {subtitle ? <p className={uiCardSubtitleClass}>{subtitle}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(uiCardBodyClass, className)}>{children}</div>;
}

export function CardFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(uiCardFooterClass, className)}>{children}</div>;
}

export default Card;
