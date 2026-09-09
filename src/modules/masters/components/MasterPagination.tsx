import type { KeyboardEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../../../i18n";
import { isEditableTarget } from "../../../utils/interaction";
import { cn } from "../../../utils/cn";
import {
  uiPaginationBarClass,
  uiPaginationNavButtonClass,
  uiPaginationPageButtonClass,
} from "../../../shared/ui/uiTokens";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * Master-list pagination footer.
 *
 * Now shares the global pagination treatment (`shared/ui/uiTokens`), so a master
 * directory and an operations table render the identical 32px bar, 8px radius,
 * emerald current-page chip and focus ring — previously masters had their own
 * 36px `rounded-xl` bar next to the global one.
 *
 * Behaviour added from the global standard, all keyboard-first:
 *   • clicking the current page is a no-op (no redundant refetch),
 *   • Home / End jump to the first / last page,
 *   • arrow keys move page by page, and are ignored while the user is typing in
 *     a search or filter field (never hijacks text-input navigation).
 *
 * `children` keeps its slot on the left for the row-count summary.
 */
export default function MasterPagination({
  page,
  totalPages,
  onPageChange,
  disabled,
  children,
}: Props) {
  const { t } = useI18n();

  // Bounded page window: five buttons on wide screens, three on phones, so a
  // 200-page directory stays tidy and never wraps the footer.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const mobileStart = Math.max(1, Math.min(page - 1, totalPages - 2));
  const pages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => start + index,
  );

  const goTo = (next: number) => {
    if (disabled) return;
    const clamped = Math.min(Math.max(1, next), Math.max(1, totalPages));
    if (clamped === page) return; // no-op: never re-request the same page
    onPageChange(clamped);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        goTo(page - 1);
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        goTo(page + 1);
        break;
      case "Home":
        event.preventDefault();
        goTo(1);
        break;
      case "End":
        event.preventDefault();
        goTo(totalPages);
        break;
      default:
        break;
    }
  };

  return (
    <div
      className={cn(
        uiPaginationBarClass,
        "gap-3 rounded-b-xl border-t border-slate-200 bg-white px-4 py-3",
      )}
    >
      {children && <div className="mr-auto">{children}</div>}
      <nav
        aria-label={t("masters.ui.pagination")}
        className="flex items-center gap-1.5"
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={disabled || page <= 1}
          className={uiPaginationNavButtonClass}
        >
          <ChevronLeft aria-hidden="true" />
          <span className="hidden sm:inline">{t("common.previous")}</span>
        </button>
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => goTo(number)}
            disabled={disabled}
            aria-current={number === page ? "page" : undefined}
            aria-label={t("masters.ui.page", { page: number })}
            className={cn(
              uiPaginationPageButtonClass(number === page),
              number >= mobileStart && number < mobileStart + 3
                ? "inline-flex"
                : "hidden sm:inline-flex",
            )}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={disabled || page >= totalPages}
          className={uiPaginationNavButtonClass}
        >
          <span className="hidden sm:inline">{t("common.next")}</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
