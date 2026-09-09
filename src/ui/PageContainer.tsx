/**
 * =============================================================================
 * GLOBAL PAGE LAYOUT — PageContainer + PageHeader
 * =============================================================================
 * One page rhythm for every module: the same left/right/top/bottom spacing, the
 * same content width, the same gap between sections, and the same header
 * structure. Spacing comes from the `--ds-page-*` tokens, which are themselves
 * responsive, so a page never has to repeat breakpoint classes (and can never
 * drift from its neighbours).
 *
 * HEADER STRUCTURE (left → right)
 *   breadcrumb (optional) · title · subtitle      |      actions
 *
 * Actions wrap onto their own line below `sm` instead of overflowing, and the
 * header keeps a fixed internal rhythm so it does not shift height when a
 * subtitle or a badge appears.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../utils/cn";
import {
  uiBreadcrumbClass,
  uiBreadcrumbCurrentClass,
  uiBreadcrumbLinkClass,
  uiPageActionsClass,
  uiPageClass,
  uiPageHeaderClass,
  uiPageInnerClass,
  uiPageSubtitleClass,
  uiPageTitleClass,
} from "../shared/ui/uiTokens";

export interface BreadcrumbItem {
  label: ReactNode;
  /** Omit for the current (non-clickable) crumb. */
  to?: string;
  onClick?: () => void;
}

/* ---------------------------------------------------------------------------
 * PageHeader
 * ------------------------------------------------------------------------- */

export interface PageHeaderProps {
  title: ReactNode;
  /** One-line description of what the page is for. */
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  /** Primary action (rendered first, visually strongest). */
  primaryAction?: ReactNode;
  /** Secondary actions: refresh, import, export, reset, filters… */
  actions?: ReactNode;
  /** Small status/count element shown beside the title. */
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  primaryAction,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  const hasActions = Boolean(primaryAction || actions);

  return (
    <header className={cn(uiPageHeaderClass, className)}>
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className={cn(uiBreadcrumbClass, "mb-1.5")}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={index} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight size={12} aria-hidden="true" className="text-slate-300" />
                  ) : null}
                  {isLast || (!crumb.to && !crumb.onClick) ? (
                    <span className={uiBreadcrumbCurrentClass} aria-current={isLast ? "page" : undefined}>
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={crumb.onClick}
                      className={cn(uiBreadcrumbLinkClass, uiBreadcrumbClass && "")}
                    >
                      {crumb.label}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <h1 className={uiPageTitleClass}>{title}</h1>
          {badge}
        </div>

        {subtitle ? <p className={uiPageSubtitleClass}>{subtitle}</p> : null}
      </div>

      {hasActions ? (
        <div className={uiPageActionsClass}>
          {actions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * PageContainer
 * ------------------------------------------------------------------------- */

export interface PageContainerProps {
  children: ReactNode;
  /** Renders a standard PageHeader above the content. */
  title?: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  /** Tighter vertical rhythm for dense operational pages. */
  dense?: boolean;
  className?: string;
  /** Extra class on the inner content column. */
  contentClassName?: string;
}

export function PageContainer({
  children,
  title,
  subtitle,
  breadcrumbs,
  primaryAction,
  actions,
  badge,
  dense = false,
  className,
  contentClassName,
}: PageContainerProps) {
  return (
    <div className={cn(uiPageClass, className)}>
      <div className={cn(uiPageInnerClass, dense && "gap-4", contentClassName)}>
        {title ? (
          <PageHeader
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            primaryAction={primaryAction}
            actions={actions}
            badge={badge}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

export default PageContainer;
