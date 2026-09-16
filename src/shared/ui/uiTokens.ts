/**
 * =============================================================================
 * DMR Poultries ERP — GLOBAL UI CLASS TOKENS
 * =============================================================================
 * The TypeScript side of the design system. Every class string here is derived
 * from the CSS tokens in `src/styles/tokens.css`.
 *
 *   Design tokens (CSS)  →  uiTokens (this file)  →  components  →  pages
 *
 * WHY THIS FILE EXISTS
 *   The same semantic action (PDF, Excel, Reset, Refresh, Delete, Search…) must
 *   look identical in every module. Previously each page hand-wrote its own
 *   class string, so "PDF" was rose in Operations, neutral slate in Masters and
 *   blue in Reports; "delete" alternated between red and rose. Importing one
 *   token from here is now the easiest way to build a control, so the correct
 *   design is also the path of least resistance for future modules.
 *
 * RULES
 *   • Visual only. No business logic, no API behaviour, no page math.
 *   • Heights are explicit so toolbar rows share one invisible grid.
 *   • Transitions animate colour/border/shadow only — never `transform`, and
 *     never `transition-all` (which animates layout properties and can cause
 *     reflow, flicker or apparent movement of controls).
 *   • Every icon-only token pairs with an accessible name at the call site.
 * =============================================================================
 */

/* ---------------------------------------------------------------------------
 * PRIMITIVES — shared fragments
 * ------------------------------------------------------------------------- */

/** One consistent focus indicator (matches the global `:focus-visible` rule). */
export const uiFocusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

/** Inset focus treatment for text-entry controls (no layout shift). */
export const uiFocusInset =
  "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none";

/** Standard disabled treatment. */
export const uiDisabled =
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none";

/** Colour-only transition. Deliberately NOT `transition-all`. */
export const uiTransition = "transition-colors duration-150";

/** Prevents long labels from stretching a control or wrapping mid-word. */
export const uiNoWrap = "whitespace-nowrap";

/* ---------------------------------------------------------------------------
 * CONTROL HEIGHTS — the invisible grid
 * ------------------------------------------------------------------------- */
export const controlHeight = {
  /** 28px — dense in-table action */
  xs: "h-7",
  /** 32px — compact button, pagination, icon-only */
  sm: "h-8",
  /** 36px — default button, dialog actions */
  md: "h-9",
  /** 40px — toolbar row: search, filters, exports, primary page action */
  lg: "h-10",
} as const;

export type ControlHeight = keyof typeof controlHeight;

/* ---------------------------------------------------------------------------
 * 1. BUTTONS
 * -------------------------------------------------------------------------
 * One button system: primary / secondary / outline / ghost / destructive /
 * success / info, in four sizes, plus icon-only and loading treatments.
 * ------------------------------------------------------------------------ */

const buttonBase = [
  "relative inline-flex shrink-0 items-center justify-center gap-1.5",
  "rounded-lg font-semibold",
  "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
  "hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:scale-[0.98]",
  uiFocusRing,
  uiDisabled,
  uiNoWrap,
  "select-none",
].join(" ");

const buttonSizes = {
  xs: "h-7 px-2 text-[11px]",
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-10 px-4 text-[13px]",
} as const;

export type ButtonSize = keyof typeof buttonSizes;

const buttonVariants = {
  /**
   * Structure only — no colour classes. Use with `className` when the tone
   * comes from a semantic action token (PDF / Excel / Import / Export …), so
   * structure and colour can never disagree.
   */
  custom: "",
  /** Brand action — the one obvious next step on a page. */
  primary:
    "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800",
  /** Supportive action, visually quieter than primary. */
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100",
  /** Neutral outline — no surface fill. */
  outline:
    "border border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100",
  /** Borderless, lowest emphasis (toolbars, dialogs, row actions). */
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
  /** Destructive / irreversible. Always rose — never red, never orange. */
  destructive:
    "bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800",
  /** Destructive, quiet — for row-level delete affordances. */
  destructiveOutline:
    "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100",
  /** Positive confirmation. */
  success:
    "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800",
  /** Informational. */
  info: "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 hover:border-sky-300 active:bg-sky-100",
  /** "View / inspect" action — light violet outline, so it sits beside PDF
   *  (rose) and Excel (emerald) as a quiet, non-primary look-and-inspect. */
  view: "border border-violet-200 bg-white text-violet-600 hover:bg-violet-50 hover:border-violet-300 active:bg-violet-100",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

/**
 * Full button class string.
 * @example cn(uiButton("primary", "lg"), extraClass)
 */
export function uiButton(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
): string {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]}`;
}

/** Default (primary) button — convenient constant for the common case. */
export const uiPrimaryButtonClass = uiButton("primary", "md");
export const uiSecondaryButtonClass = uiButton("secondary", "md");
export const uiOutlineButtonClass = uiButton("outline", "md");
export const uiGhostButtonClass = uiButton("ghost", "md");
export const uiDestructiveButtonClass = uiButton("destructive", "md");
export const uiViewButtonClass = uiButton("view", "md");

/**
 * Toolbar-height button. Toolbar rows mix a 40px search/filter control with
 * action buttons; giving the buttons the same height is what makes the row read
 * as one aligned grid instead of a random collection of buttons.
 */
export const uiToolbarButtonClass = uiButton("secondary", "lg");
export const uiToolbarPrimaryButtonClass = uiButton("primary", "lg");

/**
 * Icon-only button. The call site MUST supply an accessible name
 * (`aria-label` or `title` + visually-hidden text) — see `<IconButton />`.
 */
const iconButtonBase = [
  "inline-flex shrink-0 items-center justify-center",
  "rounded-lg",
  uiTransition,
  uiFocusRing,
  uiDisabled,
].join(" ");

const iconButtonSizes = {
  xs: "h-7 w-7 [&_svg]:size-3.5",
  sm: "h-8 w-8 [&_svg]:size-4",
  md: "h-9 w-9 [&_svg]:size-[18px]",
  lg: "h-10 w-10 [&_svg]:size-5",
} as const;

export type IconButtonSize = keyof typeof iconButtonSizes;

export function uiIconButton(
  variant: ButtonVariant = "ghost",
  size: IconButtonSize = "sm",
): string {
  return `${iconButtonBase} ${iconButtonSizes[size]} ${buttonVariants[variant]}`;
}

/* ---------------------------------------------------------------------------
 * 2. SEMANTIC ACTION BUTTONS — PDF / Excel / Import / Export
 * -------------------------------------------------------------------------
 * The same semantic action now has exactly one visual language project-wide.
 *
 *   PDF     → rose outline    (document convention, quiet so it never reads
 *                              as destructive: outline + FileText icon)
 *   Excel   → emerald outline (spreadsheet convention)
 *   Import  → emerald solid   (writes data → primary-weight action)
 *   Export  → slate outline   (reads data out → secondary-weight action)
 *   Reset   → ghost slate     (local, reversible, low emphasis)
 *   Refresh → ghost slate     (local, reversible, low emphasis)
 *
 * All are 40px tall so they align with the search/filter controls beside them.
 * ------------------------------------------------------------------------ */

const actionButtonBase = [
  "inline-flex shrink-0 items-center justify-center gap-1.5",
  controlHeight.lg,
  "rounded-lg px-3 text-xs font-semibold",
  uiTransition,
  uiFocusRing,
  uiDisabled,
  uiNoWrap,
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

/**
 * COLOUR-ONLY tones for the semantic actions.
 *
 * Split out from the structural base so the same tone can be applied to a
 * full-height toolbar button, an icon-only compact button, or a `<Button
 * variant="custom">` — structure and colour can never disagree, and there is
 * exactly one place that decides "what colour is a PDF action".
 */
export const uiActionToneClass = {
  pdf:
    "border border-rose-200 bg-white text-rose-600 " +
    "hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100",
  excel:
    "border border-emerald-200 bg-white text-emerald-700 " +
    "hover:bg-emerald-50 hover:border-emerald-300 active:bg-emerald-100",
  import:
    "bg-emerald-600 text-white shadow-xs " +
    "hover:bg-emerald-700 active:bg-emerald-800",
  export:
    "border border-slate-200 bg-white text-slate-700 shadow-xs " +
    "hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100",
  reset:
    "bg-transparent text-slate-600 " +
    "hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
  refresh:
    "bg-transparent text-slate-600 " +
    "hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200",
} as const;

export type ActionTone = keyof typeof uiActionToneClass;

/** Full-height (40px) toolbar button for a semantic action. */
export const uiPdfButtonClass = `${actionButtonBase} ${uiActionToneClass.pdf}`;
export const uiExcelButtonClass = `${actionButtonBase} ${uiActionToneClass.excel}`;
export const uiImportButtonClass = `${actionButtonBase} ${uiActionToneClass.import}`;
export const uiExportButtonClass = `${actionButtonBase} ${uiActionToneClass.export}`;
export const uiResetButtonClass = `${actionButtonBase} ${uiActionToneClass.reset}`;
export const uiRefreshButtonClass = `${actionButtonBase} ${uiActionToneClass.refresh}`;

/** Icon-only (32px) variants of the same semantic actions, for dense toolbars. */
const actionIconBase = [
  "inline-flex shrink-0 items-center justify-center",
  controlHeight.sm,
  "w-8 rounded-lg",
  uiTransition,
  uiFocusRing,
  uiDisabled,
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

export const uiPdfIconButtonClass = `${actionIconBase} ${uiActionToneClass.pdf}`;
export const uiExcelIconButtonClass = `${actionIconBase} ${uiActionToneClass.excel}`;
export const uiResetIconButtonClass = `${actionIconBase} ${uiActionToneClass.reset}`;
export const uiRefreshIconButtonClass = `${actionIconBase} ${uiActionToneClass.refresh}`;

/** Canonical icon sizes for the action family (keep glyphs visually equal). */
export const actionIconSize = 16;
export const actionIconSizeCompact = 14;

/** Semantic hover motion for action glyphs. Wrap the icon in an inline-flex span
 * inside a `group` button/link so PDF, Mail, WhatsApp, Edit, Delete, etc. keep
 * the same animation language everywhere.
 *
 * Deliberately NOT gated behind `prefers-reduced-motion`: these glyphs ARE the
 * affordance's meaning (approve ticks, rejects shake, bins dump), so they must
 * animate for every user — same product decision as the brand refresh hen. */
export const uiActionIconMotionClass = {
  search: "group-hover:animate-[var(--animate-action-search)]",
  reset: "group-hover:animate-[var(--animate-action-reset)]",
  edit: "group-hover:animate-[var(--animate-action-edit)]",
  delete: "group-hover:animate-[var(--animate-action-delete)]",
  view: "group-hover:animate-[var(--animate-action-view)]",
  pdf: "group-hover:animate-[var(--animate-action-pdf)]",
  mail: "group-hover:animate-[var(--animate-action-mail)]",
  whatsapp: "group-hover:animate-[var(--animate-action-whatsapp)]",
  close: "group-hover:animate-[var(--animate-action-close)]",
  excel: "group-hover:animate-[var(--animate-action-excel)]",
  approve: "group-hover:animate-[var(--animate-action-approve)]",
  reject: "group-hover:animate-[var(--animate-action-reject)]",
} as const;

/* ---------------------------------------------------------------------------
 * 3. FORM CONTROLS
 * ------------------------------------------------------------------------- */

/** Text input / number input / combobox trigger. 40px, control radius. */
export const uiInputClass = [
  controlHeight.lg,
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3",
  "text-[13px] font-medium text-slate-800",
  "placeholder:text-slate-400 placeholder:font-normal",
  uiFocusInset,
  uiTransition,
  uiDisabled,
  "shadow-xs",
].join(" ");

/** Same chrome for `<select>`, plus room for the native arrow. */
export const uiSelectClass = `${uiInputClass} pr-8 appearance-none`;

/** Textarea shares the input chrome but grows vertically. */
export const uiTextareaClass = [
  "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2",
  "text-[13px] font-medium text-slate-800 leading-relaxed",
  "placeholder:text-slate-400 placeholder:font-normal",
  uiFocusInset,
  uiTransition,
  uiDisabled,
  "shadow-xs resize-y min-h-[80px]",
].join(" ");

/** Error state — swaps the border/ring colour only (no size change, no jump). */
export const uiInputErrorClass =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20";

/** Read-only / disabled surface. */
export const uiInputReadOnlyClass = "bg-slate-50 text-slate-500";

/** Field label. */
export const uiLabelClass =
  "mb-1.5 block text-[11px] font-semibold leading-tight text-slate-600";

/** Required marker inside a label. */
export const uiRequiredMarkClass = "ml-0.5 text-rose-500";

/** Helper text (neutral) and error text (danger) share size and rhythm. */
export const uiHelperClass = "mt-1.5 text-[11px] leading-snug text-slate-400";
export const uiErrorClass = "mt-1.5 text-[11px] font-medium leading-snug text-rose-600";

/** Checkbox / radio accent — one brand colour for every selection control. */
export const uiCheckClass =
  "size-4 shrink-0 rounded border-slate-300 text-emerald-600 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 " +
  "accent-emerald-600 disabled:opacity-50";

/** A visually grouped block of related fields inside a form or dialog. */
export const uiFieldsetClass =
  "rounded-xl border border-slate-200 bg-white p-4";
export const uiFieldsetLegendClass =
  "text-[11px] font-bold uppercase tracking-wider text-slate-500";

/* ---------------------------------------------------------------------------
 * 4. SEARCH
 * -------------------------------------------------------------------------
 * One search pattern: same height, border, radius, icon, icon size,
 * placeholder treatment, focus ring, clear control and spacing everywhere.
 * ------------------------------------------------------------------------ */

export const uiSearchWrapClass = "relative flex w-full min-w-0 items-center";

/** Leading icon slot inside the search field. */
export const uiSearchIconClass =
  "pointer-events-none absolute left-3 z-10 text-slate-400 [&_svg]:size-4";

/** The search input itself (left padding clears the leading icon). */
export const uiSearchInputClass = `${uiInputClass} pl-9`;

/** Variant with room for the trailing clear button. */
export const uiSearchInputWithClearClass = `${uiInputClass} pl-9 pr-9`;

/** Trailing clear (×) control inside the search field. */
export const uiSearchClearClass = [
  "absolute right-2 z-10 inline-flex size-6 items-center justify-center",
  "rounded-md text-slate-400",
  uiTransition,
  "hover:bg-slate-100 hover:text-slate-700",
  uiFocusRing,
  "[&_svg]:size-3.5",
].join(" ");

/* ---------------------------------------------------------------------------
 * 5. FILTERS
 * ------------------------------------------------------------------------- */

/** Filter bar surface that holds search + selects + actions. */
export const uiFilterBarClass = [
  "flex flex-wrap items-end gap-3",
  "rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:p-4",
].join(" ");

/** A single labelled filter slot (label + control stacked). */
export const uiFilterFieldClass = "flex min-w-0 flex-col";

/** Filter / section micro-label.
 *  Deliberately distinct from {@link uiLabelClass}: filters and table headers
 *  use an uppercase micro-label so dense rows stay scannable, while form fields
 *  inside dialogs use a sentence-case label. Two documented roles, not two
 *  arbitrary styles. */
export const uiFilterLabelClass =
  "mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500";

/** Widths for filter controls so multi-filter rows align predictably. */
export const uiFilterWidth = {
  sm: "w-full sm:w-40",
  md: "w-full sm:w-52",
  lg: "w-full sm:w-64",
  xl: "w-full sm:w-80",
  grow: "min-w-0 flex-1",
} as const;

/** Active-filter treatment (a filter whose value differs from its default). */
export const uiFilterActiveClass = "border-emerald-400 ring-2 ring-emerald-500/15";

/* ---------------------------------------------------------------------------
 * 6. PAGE LAYOUT & HEADERS
 * ------------------------------------------------------------------------- */

/** Outer page padding. Uses the responsive token, so every module gets the
 *  same left/right/top/bottom spacing without repeating breakpoint classes. */
export const uiPageClass = "ds-page w-full min-w-0";

/** Inner content column: max width, centred, consistent section rhythm. */
export const uiPageInnerClass = "ds-page-inner";

/** Vertical rhythm for a page that stacks sections without PageContainer. */
export const uiPageStackClass = "w-full min-w-0 space-y-5";

/** Page header row: title/description on the left, actions on the right. */
export const uiPageHeaderClass = [
  "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
  "w-full min-w-0",
].join(" ");

export const uiPageTitleClass =
  "text-[17px] font-bold leading-tight tracking-[-0.011em] text-slate-900";

export const uiPageSubtitleClass =
  "mt-1 text-xs leading-relaxed text-slate-500";

/** Action cluster on the right of a page header. Wraps on narrow screens so
 *  nothing overflows horizontally. */
export const uiPageActionsClass =
  "flex flex-wrap items-center justify-start gap-2 sm:justify-end";

/** Breadcrumb row. */
export const uiBreadcrumbClass =
  "flex flex-wrap items-center gap-1 text-[11px] text-slate-400";
export const uiBreadcrumbLinkClass =
  "rounded transition-colors hover:text-slate-700 hover:underline underline-offset-2";
export const uiBreadcrumbCurrentClass = "font-medium text-slate-600";

/* ---------------------------------------------------------------------------
 * 7. CARDS & SURFACES
 * ------------------------------------------------------------------------- */

export const uiCardClass =
  "rounded-xl border border-slate-200 bg-white shadow-card";

export const uiCardHeaderClass =
  "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5";

export const uiCardTitleClass =
  "text-[13px] font-bold tracking-tight text-slate-800";

export const uiCardSubtitleClass = "mt-0.5 text-[11px] text-slate-400";

export const uiCardBodyClass = "p-4 sm:p-5";

export const uiCardFooterClass =
  "flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5";

/** Sunken secondary surface (KPI strips, inset panels). */
export const uiPanelSunkenClass =
  "rounded-lg border border-slate-200/70 bg-slate-50/70";

/* ---------------------------------------------------------------------------
 * 8. TABLES
 * -------------------------------------------------------------------------
 * One table design: header hierarchy, row height, cell padding, alignment,
 * hover/selected states and an action column that stays compact.
 * ------------------------------------------------------------------------ */

/** Scroll wrapper — keeps wide tables scrollable without overflowing the page. */
export const uiTableWrapClass =
  "w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-card";

export const uiTableClass = "w-full min-w-full border-collapse text-left";

export const uiTableHeadClass = "bg-slate-50/80";

export const uiTableThClass = [
  "px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500",
  "whitespace-nowrap border-b border-slate-200",
].join(" ");

/** Right-aligned header for numeric columns. */
export const uiTableThNumericClass = `${uiTableThClass} text-right`;

export const uiTableTdClass = [
  "px-4 py-2.5 text-xs text-slate-700 align-middle",
  "border-b border-slate-100",
].join(" ");

export const uiTableTdNumericClass =
  `${uiTableTdClass} text-right tabular-nums font-medium text-slate-800`;

export const uiTableRowClass = "transition-colors duration-100 hover:bg-slate-50/80";

/**
 * The row a pointer rests on, in the emerald analysis band.
 *
 * One token for the three surfaces of the mortality analysis: the trips grid,
 * the lines inside an open trip, and the cumulative summary below the grid. A
 * data line marks itself — and the values beside its label — wherever it is
 * read, and the three can never drift apart because there is one class string.
 * Colour only, 150ms, no layout property (see the rules at the top of the file).
 */
export const uiAnalysisRowHoverClass = `${uiTransition} hover:bg-emerald-50/60`;

/**
 * The same band, one step deeper, for a data row that already sits on a tint
 * (the survival strip closing a trip panel or the summary). A flat band would
 * be invisible on an already-tinted row.
 */
export const uiAnalysisRowHoverOnTintClass = `${uiTransition} hover:bg-emerald-100/70`;

/** Selected row — visually distinct from the focused row. */
export const uiTableRowSelectedClass = "bg-emerald-50/70 hover:bg-emerald-50";

/**
 * Keyboard-navigable row. Focus is drawn on the row itself so a keyboard user
 * can see exactly which row is active without every cell being a tab stop.
 */
export const uiTableRowFocusableClass =
  "outline-none focus-visible:bg-emerald-50/60 focus-visible:shadow-[inset_0_0_0_2px_var(--color-emerald-500)]";

/** Compact density for very wide operational tables. */
export const uiTableTdCompactClass = "px-3 py-2 text-xs text-slate-700 border-b border-slate-100";
export const uiTableThCompactClass =
  "px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap border-b border-slate-200";

/** Sticky action column (keeps row actions reachable on wide tables). */
export const uiTableActionCellClass =
  "sticky right-0 bg-white/95 backdrop-blur-[1px] px-3 py-2 text-right border-b border-slate-100";

/** Row action cluster. */
export const uiTableActionsClass = "flex items-center justify-end gap-1";

/** Footer bar that holds pagination. */
export const uiTableFooterClass =
  "flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 sm:px-4";

/* ---------------------------------------------------------------------------
 * 9. PAGINATION
 * ------------------------------------------------------------------------- */

/** Minimum record count before a pagination bar is worth showing. */
export const PAGINATION_MIN_RECORDS = 10;

/** Default page size shared across modules. */
export const PAGINATION_DEFAULT_PAGE_SIZE = 20;

export const PAGINATION_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Upper bound for a typed rows-per-page value. Rendering an unbounded number of
 * rows would freeze the tab, so custom entry is clamped to this.
 */
export const MAX_CUSTOM_PAGE_SIZE = 500;

export const uiPaginationBarClass =
  "flex w-full max-w-full flex-wrap items-center justify-end gap-1.5 px-3 py-2";

export const uiPaginationSummaryClass =
  "mr-auto text-[11px] font-medium text-slate-500 tabular-nums";

export const uiPaginationNavButtonClass = [
  controlHeight.sm,
  "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white",
  "px-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap",
  uiTransition,
  "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out",
  "hover:-translate-y-px hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:translate-y-0 active:scale-[0.98]",
  uiFocusRing,
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200",
  "[&_svg]:size-3.5",
].join(" ");

export function uiPaginationPageButtonClass(active: boolean): string {
  return [
    controlHeight.sm,
    "min-w-8 inline-flex items-center justify-center rounded-lg border px-2",
    "text-xs font-semibold tabular-nums",
    uiTransition,
    uiFocusRing,
    "disabled:cursor-not-allowed disabled:opacity-40",
    active
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
  ].join(" ");
}

export const uiPaginationEllipsisClass = "px-1 text-xs text-slate-400 select-none";

/** Page-size `<select>` sits in the pagination bar at compact height. */
export const uiPaginationSizeSelectClass = [
  controlHeight.sm,
  "rounded-lg border border-slate-200 bg-white px-2 pr-6 text-xs font-semibold text-slate-700",
  uiFocusInset,
  uiTransition,
].join(" ");

/* ---------------------------------------------------------------------------
 * 9c. FILTER-BAR ACTIONS (search / reset / big search field)
 * ---------------------------------------------------------------------------
 * One definition for the three controls every filter card ends with, so the
 * Trip List, Leave and the performance pages cannot drift apart:
 *   • the primary Search submit (40px, emerald),
 *   • its neutral Reset twin (40px, bordered, same metrics),
 *   • the 44px search field with room for a leading glyph and a trailing clear.
 * ------------------------------------------------------------------------- */
export const uiFilterSearchButtonClass = `${uiButton("primary", "lg")} group`;

export const uiFilterResetButtonClass = [
  "group relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg",
  "border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs",
  "transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100",
  "focus-visible:ring-2 focus-visible:ring-emerald-300",
].join(" ");

export const uiFilterSearchFieldClass = [
  "h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white pl-11 pr-10",
  "text-sm font-medium text-slate-800",
  "placeholder:font-normal placeholder:text-slate-400",
  uiFocusInset,
  uiTransition,
  uiDisabled,
  "shadow-xs",
].join(" ");

/* ---------------------------------------------------------------------------
 * 10. STATUS BADGES
 * -------------------------------------------------------------------------
 * One semantic → one appearance, everywhere. Unknown values fall back to the
 * neutral tone rather than inventing a colour.
 * ------------------------------------------------------------------------ */

export type StatusTone =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "brand";

const badgeBase = [
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full",
  "border px-2 py-0.5 text-[11px] font-semibold leading-4",
].join(" ");

export const statusToneClass: Record<StatusTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
  brand: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

/** Leading dot colour for a tone (optional, used by StatusBadge). */
export const statusDotClass: Record<StatusTone, string> = {
  success: "bg-emerald-500",
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
  brand: "bg-emerald-500",
};

export function uiBadgeClass(tone: StatusTone = "neutral"): string {
  return `${badgeBase} ${statusToneClass[tone]}`;
}

/**
 * Map a raw status string from any module onto a semantic tone.
 *
 * This is the single place that decides "what colour is this status", so
 * `Completed` cannot be green in one module and blue in another. Matching is
 * case- and separator-insensitive and covers the vocabulary already present in
 * the codebase; anything unrecognised is neutral.
 */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  /* ---- success ------------------------------------------------------- */
  active: "success",
  completed: "success",
  complete: "success",
  approved: "success",
  paid: "success",
  settled: "success",
  delivered: "success",
  sent: "success",
  success: "success",
  succeeded: "success",
  confirmed: "success",
  collected: "success",
  closed: "success",
  resolved: "success",
  available: "success",

  /* ---- warning / attention ------------------------------------------- */
  pending: "warning",
  partial: "warning",
  partiallypaid: "warning",
  partiallycompleted: "warning",
  awaiting: "warning",
  due: "warning",
  expiring: "warning",
  expiringsoon: "warning",
  review: "warning",
  onhold: "warning",
  hold: "warning",
  delayed: "warning",

  /* ---- danger / destructive ------------------------------------------ */
  overdue: "danger",
  rejected: "danger",
  failed: "danger",
  cancelled: "danger",
  canceled: "danger",
  deleted: "danger",
  error: "danger",
  blocked: "danger",
  expired: "danger",
  void: "danger",
  returned: "danger",
  damage: "danger",
  damaged: "danger",

  /* ---- info / in-flight ---------------------------------------------- */
  inprogress: "info",
  sending: "info",
  processing: "info",
  scheduled: "info",
  assigned: "info",
  dispatched: "info",
  intransit: "info",
  open: "info",
  new: "info",

  /* ---- neutral ------------------------------------------------------- */
  inactive: "neutral",
  draft: "neutral",
  unknown: "neutral",
  na: "neutral",
  none: "neutral",
  all: "neutral",
};

/** Normalise `"In Progress"` / `"in-progress"` / `"IN_PROGRESS"` → `inprogress`. */
export function normaliseStatusKey(status?: string | null): string {
  return (status ?? "").trim().toLowerCase().replace(/[\s_\-.]+/g, "");
}

export function statusToneFor(status?: string | null): StatusTone {
  const key = normaliseStatusKey(status);
  if (!key) return "neutral";
  return STATUS_TONE_MAP[key] ?? "neutral";
}

export function uiStatusBadgeClass(status?: string | null): string {
  return uiBadgeClass(statusToneFor(status));
}

/* ---------------------------------------------------------------------------
 * 11. LOADING
 * -------------------------------------------------------------------------
 * Data already on screen stays visible during a background refresh; the
 * overlay/inline indicators below never blank a populated table.
 * ------------------------------------------------------------------------ */

export const uiSpinnerClass = "animate-spin text-current";

/** Dimming overlay laid OVER existing content (no unmount, no blank screen). */
export const uiLoadingOverlayClass =
  "pointer-events-none absolute inset-0 z-10 flex items-center justify-center " +
  "rounded-xl bg-white/55 backdrop-blur-[0.5px] transition-opacity duration-150";

/** Inline "refreshing" strip that never changes the layout height. */
export const uiLoadingInlineClass =
  "flex items-center gap-2 text-[11px] font-medium text-slate-500";

/** Skeleton block. Stable dimensions → no layout shift while loading. */
export const uiSkeletonClass =
  "animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/50";

export const uiSkeletonRowClass = "flex items-center gap-3 px-4 py-3";

/* ---------------------------------------------------------------------------
 * 12. EMPTY STATES
 * -------------------------------------------------------------------------
 * Four distinct situations get four distinct messages but ONE visual treatment:
 * no records / no search match / no filter match / unavailable (error).
 * ------------------------------------------------------------------------ */

export const uiEmptyStateClass = [
  "flex flex-col items-center justify-center gap-2",
  "px-6 py-12 text-center",
].join(" ");

export const uiEmptyStateIconClass = [
  "mb-1 inline-flex size-10 items-center justify-center rounded-full",
  "bg-slate-100 text-slate-400 [&_svg]:size-5",
].join(" ");

export const uiEmptyStateIconErrorClass = [
  "mb-1 inline-flex size-10 items-center justify-center rounded-full",
  "bg-rose-50 text-rose-500 [&_svg]:size-5",
].join(" ");

export const uiEmptyStateTitleClass =
  "text-[13px] font-semibold text-slate-700";

export const uiEmptyStateDescriptionClass =
  "max-w-sm text-xs leading-relaxed text-slate-400";

export const uiEmptyStateActionClass = "mt-2";

/** Dashed placeholder surface used when a whole panel has no content yet. */
export const uiEmptySurfaceClass =
  "rounded-xl border border-dashed border-slate-200 bg-white/60";

/* ---------------------------------------------------------------------------
 * 13. DIALOGS / OVERLAYS
 * ------------------------------------------------------------------------- */

export const uiOverlayClass =
  "fixed inset-0 bg-slate-900/[0.05] backdrop-blur-[1px] animate-fade-in";

export const uiDialogPanelClass =
  "relative flex w-full flex-col overflow-hidden rounded-2xl border " +
  "border-slate-200/70 bg-white shadow-overlay animate-scale-in";

export const uiDialogHeaderClass =
  "flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";

export const uiDialogTitleClass =
  "text-[15px] font-bold leading-snug tracking-tight text-slate-900";

export const uiDialogDescriptionClass = "mt-1 text-xs leading-relaxed text-slate-500";

export const uiDialogBodyClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4";

export const uiDialogFooterClass =
  "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 " +
  "bg-slate-50/60 px-5 py-3";

export const uiDialogCloseClass = [
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
  "text-slate-400",
  uiTransition,
  "hover:bg-slate-100 hover:text-slate-700",
  uiFocusRing,
  "[&_svg]:size-4",
].join(" ");

/* ---------------------------------------------------------------------------
 * 14. NAVIGATION / TABS
 * ------------------------------------------------------------------------- */

export const uiTabListClass =
  "flex items-center gap-1 overflow-x-auto border-b border-slate-200 ds-no-scrollbar";

export function uiTabClass(active: boolean): string {
  return [
    "relative inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3.5 py-2",
    "text-[13px] font-semibold outline-none",
    uiTransition,
    "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600",
    active
      ? "text-emerald-700"
      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
  ].join(" ");
}

/** Underline drawn under the active tab. */
export const uiTabIndicatorClass =
  "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600";

/** Sidebar / navigation item. */
export function uiNavItemClass(active: boolean): string {
  return [
    "group relative flex w-full items-center gap-2.5 rounded-lg py-2 pl-3.5 pr-3",
    "text-[13.5px] outline-none",
    uiTransition,
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
    active
      ? "bg-emerald-50 font-semibold text-emerald-800"
      : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");
}

/* ---------------------------------------------------------------------------
 * 15. NOTIFICATIONS
 * ------------------------------------------------------------------------- */

export const uiToastViewportClass =
  "pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-center gap-2 p-3 " +
  "sm:inset-x-auto sm:right-0 sm:items-end sm:p-4";

export function uiToastClass(tone: StatusTone): string {
  const accents: Record<StatusTone, string> = {
    success: "border-emerald-200 bg-white text-slate-700",
    danger: "border-rose-200 bg-white text-slate-700",
    warning: "border-amber-200 bg-white text-slate-700",
    info: "border-sky-200 bg-white text-slate-700",
    neutral: "border-slate-200 bg-white text-slate-700",
    brand: "border-emerald-200 bg-white text-slate-700",
  };
  return [
    "pointer-events-auto flex w-full items-start gap-2.5 overflow-hidden rounded-xl",
    "border px-3.5 py-3 shadow-pop animate-toast-in",
    "sm:max-w-sm",
    accents[tone],
  ].join(" ");
}

export const uiToastIconClass: Record<StatusTone, string> = {
  success: "text-emerald-600",
  danger: "text-rose-600",
  warning: "text-amber-600",
  info: "text-sky-600",
  neutral: "text-slate-500",
  brand: "text-emerald-600",
};

export const uiToastMessageClass =
  "flex-1 pt-0.5 text-[13px] font-medium leading-relaxed text-slate-700";

export const uiToastCloseClass = [
  "-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
  "text-slate-400",
  uiTransition,
  "hover:bg-slate-100 hover:text-slate-700",
  uiFocusRing,
  "[&_svg]:size-3.5",
].join(" ");

/* ---------------------------------------------------------------------------
 * 16. MISC
 * ------------------------------------------------------------------------- */

/** Toolbar row that mixes a title/count on the left with actions on the right. */
export const uiToolbarClass =
  "flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5";

/** Section heading inside a card or page. */
export const uiSectionTitleClass =
  "text-[11px] font-bold uppercase tracking-wider text-slate-500";

/** KPI / metric value. */
export const uiMetricValueClass =
  "text-xl font-bold tracking-tight text-slate-900 tabular-nums";
export const uiMetricLabelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400";

/** Divider. */
export const uiDividerClass = "h-px w-full border-0 bg-slate-200";
export const uiVDividerClass = "h-5 w-px shrink-0 bg-slate-200";
