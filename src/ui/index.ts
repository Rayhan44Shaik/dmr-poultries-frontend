/**
 * =============================================================================
 * GLOBAL UI KIT — public entry point
 * =============================================================================
 *   import { Button, SearchInput, Pagination, StatusBadge } from "@/ui";
 *   (or the relative path: "../ui")
 *
 * A new module should build its page from these components and the semantic
 * class tokens in `src/shared/ui/uiTokens.ts` rather than hand-writing class
 * strings. That is what keeps every module visually and behaviourally identical
 * without anyone having to remember the rules.
 *
 * WHAT IS DELIBERATELY NOT HERE
 *   Header, Sidebar, CommandPalette and BrandMark are application-shell
 *   components with heavy, route-aware dependencies. They are imported directly
 *   from their own paths by the layout, and are excluded from this barrel so
 *   that importing a Button never drags the navigation graph into a chunk.
 *
 * LAYERING
 *   tokens.css (design tokens)
 *     → uiTokens.ts (semantic class strings)
 *       → ui/* (these components)
 *         → modules/pages
 * =============================================================================
 */

/* --- buttons & actions --------------------------------------------------- */
export { Button, type ButtonProps, type ButtonVariantName } from "./Button";
export {
  ActionToolbar,
  ExcelButton,
  ExportButton,
  ImportButton,
  PdfButton,
  RefreshButton,
  ResetButton,
  type ActionButtonProps,
  type ActionToolbarProps,
} from "./ExportActions";
/** Canonical branded refresh control (emerald + animated hen logo). */
export {
  BrandRefreshButton,
  type BrandRefreshButtonProps,
} from "./BrandRefreshButton";

/* --- forms --------------------------------------------------------------- */
export { Field, type FieldProps, type FieldIds } from "./Field";
export { Input, type InputProps } from "./Input";
export { Select, type SelectProps, type SelectOption } from "./Select";
export { SearchInput, type SearchInputProps } from "./SearchInput";

/* --- surfaces & layout --------------------------------------------------- */
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  type CardProps,
} from "./Card";
export {
  PageContainer,
  PageHeader,
  type BreadcrumbItem,
  type PageContainerProps,
  type PageHeaderProps,
} from "./PageContainer";

/* --- overlays ------------------------------------------------------------ */
export { Modal, type ModalProps, type ModalSize } from "./Modal";
export { default as AppShellModal } from "./AppShellModal";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { confirmDialog, type ConfirmOptions, type ConfirmTone } from "./confirm/confirmStore";

/* --- data display -------------------------------------------------------- */
export { Tabs, type TabItem, type TabsProps } from "./Tabs";
export {
  KpiCardGrid,
  KpiMetricValue,
  compactKpiValue,
  type CompactKpiValue,
  type KpiCardItem,
  type KpiTone,
} from "./KpiCardGrid";
export { Pagination, type PaginationProps } from "./Pagination";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { EmptyState, type EmptyStateProps, type EmptyVariant } from "./EmptyState";
export {
  LoadingOverlay,
  Skeleton,
  Spinner,
  TableSkeleton,
  type LoadingOverlayProps,
  type SkeletonProps,
  type SpinnerProps,
  type TableSkeletonProps,
} from "./Loading";

/* --- notifications ------------------------------------------------------- */
export { default as NotificationHost } from "./notifications/NotificationHost";
export {
  dismiss as dismissNotification,
  dismissAll as dismissAllNotifications,
  notify,
  push as pushNotification,
  type NotificationItem,
  type NotificationTone,
} from "./notifications/notificationStore";

/* --- the tokens themselves, for pages that need an ad-hoc element --------- */
export * from "../shared/ui/uiTokens";
