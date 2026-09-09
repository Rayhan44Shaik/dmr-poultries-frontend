/**
 * =============================================================================
 * GLOBAL STATUS BADGE
 * =============================================================================
 * One semantic status → one appearance, everywhere. Previously `Completed` was
 * emerald in Operations, sky in Masters and slate in Reports; `Rejected`
 * alternated between red and rose. Every badge now resolves through the single
 * `statusToneFor()` map in `shared/ui/uiTokens`.
 *
 * TREATMENT
 *   Compact pill, hairline border, tinted background, medium-weight label and an
 *   optional leading dot. Deliberately NOT a saturated solid fill: dozens of
 *   badges in a dense ERP table should inform, not shout.
 *
 * ACCESSIBILITY
 *   The colour is never the only carrier of meaning — the text label is always
 *   rendered. The dot is `aria-hidden`.
 *
 * I18N
 *   Uses the i18n context directly (not `useI18n`, which throws) so the badge
 *   also works outside a provider — in tests, previews and print layouts — and
 *   simply renders the raw status when no translation is available.
 * =============================================================================
 */

import type { ReactNode } from "react";
import { useContext } from "react";
import { I18nContext } from "../i18n/context";
import { translateStatus } from "../i18n";
import { cn } from "../utils/cn";
import {
  statusDotClass,
  statusToneFor,
  uiBadgeClass,
  type StatusTone,
} from "../shared/ui/uiTokens";

export interface StatusBadgeProps {
  /** Raw status value from the API, e.g. "Completed", "Pending", "In Progress". */
  status?: string | null;
  /** Force a tone instead of deriving it from `status`. */
  tone?: StatusTone;
  /** Override the rendered text (defaults to the translated status). */
  label?: ReactNode;
  /** Show the leading colour dot. Default true. */
  dot?: boolean;
  /** Slightly larger for detail panels rather than dense tables. */
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  status,
  tone,
  label,
  dot = true,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const i18n = useContext(I18nContext);

  const resolvedTone = tone ?? statusToneFor(status);

  const text: ReactNode =
    label ??
    (status
      ? i18n
        ? translateStatus(i18n.t, status)
        : status
      : "—");

  return (
    <span
      className={cn(
        uiBadgeClass(resolvedTone),
        size === "md" && "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", statusDotClass[resolvedTone])}
        />
      ) : null}
      <span className="truncate">{text}</span>
    </span>
  );
}

export default StatusBadge;
