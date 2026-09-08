import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { useI18n } from "../../../i18n";

export interface MasterDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface MasterDropdownProps {
  label: string;
  value: string;
  options: readonly (string | MasterDropdownOption)[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  allowClear?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hideLabel?: boolean;
  labelStyle?: "filter" | "field";
  className?: string;
  /** Action menus (Export) share the chrome, but use menu/menuitem semantics. */
  kind?: "select" | "action";
  /** Inline only for the month/year menus inside the calendar's own popup. */
  portal?: boolean;
}

/**
 * Salary Register's Department / Employee reference, shared by every master:
 * 36px white control, 12px corners, compact type, 36px menu rows, optional
 * inset search and a subtle brand-tinted selection. Menus are portalled out
 * of scrolling forms/tables without leaving their containing modal.
 */
export default function MasterDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = label,
  searchable = false,
  allowClear = false,
  disabled = false,
  required = false,
  error,
  hideLabel = false,
  labelStyle = "filter",
  className = "",
  kind = "select",
  portal = true,
}: MasterDropdownProps) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeaheadRef = useRef({ text: "", time: 0 });
  const isOpen = open && !disabled;

  const items = useMemo<MasterDropdownOption[]>(() => {
    const normalized = options.map((option) =>
      typeof option === "string" ? { value: option, label: option } : option,
    );
    return allowClear
      ? [
          { value: "", label: placeholder },
          ...normalized.filter((option) => option.value !== ""),
        ]
      : normalized;
  }, [options, allowClear, placeholder]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return items.filter(
      (option) =>
        (allowClear && option.value === "") ||
        !keyword ||
        option.label.toLocaleLowerCase().includes(keyword),
    );
  }, [items, query, allowClear]);
  const noMatches = !filtered.some(
    (option) => !(allowClear && option.value === ""),
  );
  const selected = items.find((option) => option.value === value);
  const activeId =
    active >= 0 && filtered[active] ? `${id}-option-${active}` : undefined;

  const close = (restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    typeaheadRef.current = { text: "", time: 0 };
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };
  const show = (last = false) => {
    if (disabled) return;
    setPortalTarget(
      rootRef.current?.closest<HTMLElement>("[data-master-dialog]") ??
        document.body,
    );
    setQuery("");
    const selectedIndex = items.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    const enabled = items.flatMap((option, index) =>
      option.disabled ? [] : [index],
    );
    setActive(
      selectedIndex >= 0
        ? selectedIndex
        : ((last ? enabled[enabled.length - 1] : enabled[0]) ?? -1),
    );
    setOpen(true);
  };
  const pick = (option: MasterDropdownOption) => {
    if (disabled || option.disabled) return;
    onChange(option.value);
    close(true);
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportWidth =
        viewport?.width ?? document.documentElement.clientWidth;
      const desiredHeight =
        Math.min(Math.max(filtered.length + (noMatches ? 1 : 0), 1) * 36, 180) +
        (searchable ? 46 : 0) +
        2;
      const below = viewportTop + viewportHeight - rect.bottom - 8;
      const above = rect.top - viewportTop - 8;
      const upwards = below < desiredHeight + 4 && above > below;
      const maxHeight = Math.max(
        36,
        Math.min(desiredHeight, (upwards ? above : below) - 4),
      );
      const width = Math.min(rect.width, viewportWidth - 16);
      setPosition(
        portal
          ? {
              position: "fixed",
              width,
              left: Math.max(
                viewportLeft + 8,
                Math.min(rect.left, viewportLeft + viewportWidth - width - 8),
              ),
              top: upwards ? rect.top - maxHeight - 4 : rect.bottom + 4,
              maxHeight,
            }
          : {
              position: "absolute",
              width: "100%",
              left: 0,
              ...(upwards
                ? { bottom: "calc(100% + 4px)" }
                : { top: "calc(100% + 4px)" }),
              maxHeight,
            },
      );
    };
    updatePosition();
    // Capture scrolls from nested form/table containers, not just the window.
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) updatePosition();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (triggerRef.current) observer.observe(triggerRef.current);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      observer.disconnect();
    };
  }, [isOpen, searchable, filtered.length, noMatches, portal]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen || !activeId) return;
    // Scroll only the option list; scrollIntoView would also move the form.
    const option = document.getElementById(activeId);
    const list = option?.parentElement;
    if (option && list) {
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (
        option.offsetTop + option.offsetHeight >
        list.scrollTop + list.clientHeight
      ) {
        list.scrollTop =
          option.offsetTop + option.offsetHeight - list.clientHeight;
      }
    }
  }, [activeId, isOpen]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    const inSearch = event.target === searchRef.current;
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation(); // Close just this menu, not its parent form/calendar.
      close(true);
    } else if (event.key === "Tab" && isOpen) {
      // The search is portalled: anchor native Tab order back at the trigger.
      if (inSearch) triggerRef.current?.focus({ preventScroll: true });
      close();
    } else if (
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
      !(inSearch && ["Home", "End"].includes(event.key))
    ) {
      event.preventDefault();
      if (!isOpen) {
        show(event.key === "ArrowUp" || event.key === "End");
        return;
      }
      const enabled = filtered.flatMap((option, index) =>
        option.disabled ? [] : [index],
      );
      const current = enabled.indexOf(active);
      const next =
        event.key === "Home"
          ? enabled[0]
          : event.key === "End"
            ? enabled[enabled.length - 1]
            : event.key === "ArrowDown"
              ? enabled[(current + 1) % enabled.length]
              : enabled[(current <= 0 ? enabled.length : current) - 1];
      setActive(next ?? -1);
    } else if (event.key === "Enter" || (event.key === " " && !inSearch)) {
      event.preventDefault();
      if (!isOpen) show();
      else if (filtered[active]) pick(filtered[active]);
    } else if (
      !inSearch &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = event.timeStamp;
      const text =
        (now - typeaheadRef.current.time < 700
          ? typeaheadRef.current.text
          : "") + event.key.toLocaleLowerCase();
      typeaheadRef.current = { text, time: now };
      if (!isOpen) show();
      const index = items.findIndex(
        (option) =>
          !option.disabled && option.label.toLocaleLowerCase().startsWith(text),
      );
      if (index >= 0) setActive(index);
    }
  };

  const panel = isOpen && (
    <div
      ref={panelRef}
      data-master-dropdown-panel
      onKeyDown={handleKeyDown}
      className="z-[100] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white font-sans shadow-lg"
      style={position}
    >
      {searchable && (
        <div className="shrink-0 border-b border-slate-100 p-1.5">
          <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2">
            <Search
              size={12}
              aria-hidden="true"
              className="shrink-0 text-slate-400"
            />
            <input
              ref={searchRef}
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                const keyword = event.target.value.trim().toLocaleLowerCase();
                const matches = items.filter(
                  (option) =>
                    (allowClear && option.value === "") ||
                    !keyword ||
                    option.label.toLocaleLowerCase().includes(keyword),
                );
                setActive(
                  matches.findIndex(
                    (option) =>
                      !option.disabled &&
                      (!keyword || !(allowClear && option.value === "")),
                  ),
                );
              }}
              aria-label={`${t("common.search")} ${label}`}
              aria-controls={`${id}-list`}
              aria-activedescendant={activeId}
              placeholder={t("masters.ui.search_options")}
              className="min-w-0 w-full bg-transparent text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
        </div>
      )}
      <div
        id={`${id}-list`}
        role={kind === "action" ? "menu" : "listbox"}
        aria-label={label}
        className="relative min-h-0 overflow-y-auto overscroll-contain"
        style={{ maxHeight: 180 }}
      >
        {filtered.map((option, index) => (
          <button
            key={option.value}
            id={`${id}-option-${index}`}
            type="button"
            tabIndex={-1}
            role={kind === "action" ? "menuitem" : "option"}
            aria-selected={
              kind === "select" ? option.value === value : undefined
            }
            disabled={option.disabled}
            onClick={() => pick(option)}
            onPointerMove={() => {
              if (!option.disabled) setActive(index);
            }}
            className={`flex h-9 w-full shrink-0 items-center gap-2 px-3 text-left text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
              kind === "select" && option.value === value
                ? "bg-blue-50 text-blue-600"
                : index === active
                  ? "bg-slate-50 text-slate-700"
                  : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {option.icon && (
              <span className="shrink-0" aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span className="truncate" title={option.label}>
              {option.label}
            </span>
          </button>
        ))}
        {noMatches && (
          <div
            role="status"
            className="flex h-9 items-center px-3 text-xs text-slate-400"
          >
            {t("masters.ui.no_matches")}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {!hideLabel && (
        <label
          htmlFor={id}
          className={
            labelStyle === "filter"
              ? "mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
              : "mb-1.5 block text-xs font-semibold text-slate-600"
          }
        >
          {label}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role={kind === "select" ? "combobox" : undefined}
        aria-label={label}
        aria-haspopup={kind === "action" ? "menu" : "listbox"}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-list` : undefined}
        aria-activedescendant={isOpen && !searchable ? activeId : undefined}
        aria-required={kind === "select" ? required : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => (isOpen ? close() : show())}
        onKeyDown={handleKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-xs font-medium text-slate-700 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
        }`}
      >
        <span
          className={`truncate ${kind === "select" && !value ? "text-slate-400" : "text-slate-700"}`}
        >
          {kind === "action"
            ? placeholder
            : selected?.label || value || placeholder}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {panel &&
        (portal && portalTarget ? createPortal(panel, portalTarget) : panel)}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
