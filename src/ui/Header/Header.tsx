// src/ui/Header/Header.tsx
// Premium top header: breadcrumbs, global search (command palette),
// notifications, quick actions, theme toggle and user profile.

// src/ui/Header/Header.tsx
// Premium top header: breadcrumbs, global search (command palette),
// notifications, quick actions, theme toggle and user profile.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Banknote,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  LogOut,
  KeyRound,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import { NAV_CHILD_GROUPS, quickActionsForRole, resolveRoute } from "../../routes/navigation";
import { useAuth } from "../../providers/authContext";
import { canAccessNavPath, hasCapability, CAPABILITIES } from "../../modules/auth/permissions";
import ChangePasswordDialog from "../../modules/auth/ChangePasswordDialog";
import MfaSettingsDialog from "../../modules/auth/MfaSettingsDialog";
import { useTheme } from "../../providers/ThemeProvider";
import { SHOW_THEME_CONTROLS } from "../../providers/themeControls";
import { translateRole, useI18n } from "../../i18n";
import { personNameLabel } from "../../i18n/displayNames";
import FontScaleControl from "./FontScaleControl";
import LanguageSwitcher from "./LanguageSwitcher";
import { getPendingCollectionSnapshot, subscribePendingCollectionSnapshot } from "../../modules/operations/collections/services/collectionSnapshot";
import { useViewLayerOpen } from "../../shared/ui/viewLayer";
import { usePendingApprovals } from "../../modules/approvals/hooks/usePendingApprovals";
import { startApprovalPolling } from "../../modules/approvals/services/approvalSnapshot";
import { PENDING_LEAVES_PATH } from "../../modules/staff/utils/leaveDeepLink";
import { listTrips } from "../../modules/operations/vehicle-trips/services/tripHeaderApiService";
import { permitApi } from "../../modules/fleet-operations/services/permitApi";
import { formatINR, formatRelativeTime } from "../../utils/format";

interface HeaderProps {
  onMenuClick: () => void;
  /** True while the navigation popup is open (highlights the menu button). */
  menuOpen?: boolean;
  onOpenCommand: () => void;
}

interface NotificationItem {
  id: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "info" | "success";
  title: string;
  description: string;
  time: string;
  path: string;
}

/* ------------------------------------------------------------------ */
/*  Dropdown shell with outside-click + Escape handling                */
/* ------------------------------------------------------------------ */
function Dropdown({
  trigger,
  children,
  align = "right",
  width = "w-80",
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger(open, toggle)}
      {open && (
        <div
          className={`absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-pop animate-scale-in dark:border-slate-700 dark:bg-slate-800 ${
            align === "right" ? "right-0" : "left-0"
          } ${width}`}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
  badge,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  badge?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${className}`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */
function Header({ onMenuClick, menuOpen = false, onOpenCommand }: HeaderProps) {
  const location = useLocation();
  /* A full-screen view (Trip List view, Driver/Supervisor details, …) renders
     above the page but below this header, so search, language and the
     notification dropdown keep working while it is open. */
  const viewOpen = useViewLayerOpen();
  const { theme, toggleTheme } = useTheme();
  const { language, t } = useI18n();
  const { user, logout } = useAuth();
  const roleLabel = (role: string) => translateRole(t, role);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);

  const route = useMemo(() => resolveRoute(location.pathname + location.search), [location.pathname, location.search]);

  /* The account chip shows the signed-in identity; before the session arrives
     (or in demos without one) it falls back to the owner account. */
  const displayName = user ? personNameLabel(t, language, user.displayName) : personNameLabel(t, language, "Owner");
  const displayRole = user?.role ?? "OWNER";
  const initials = displayName.charAt(0).toUpperCase();

  // Quick actions and the profile-menu Settings entry follow the role's access.
  const quickActions = useMemo(() => quickActionsForRole(user?.role), [user?.role]);
  const settingsAllowed = canAccessNavPath(user?.role, "/settings?tab=profile");
  const canApproveAnything = hasCapability(user?.role, CAPABILITIES.COLLECTION_APPROVE);
  const handleSignOut = useCallback(() => {
    void logout();
  }, [logout]);

  /* ----- Browser/page title from route metadata (translated) ----- */
  useEffect(() => {
    const key = route.page?.titleKey ?? `page_title.${route.section?.id ?? ""}`;
    const fallback = route.page?.label ?? route.section?.label ?? "DMR Poultry";
    const translated = key && key !== "page_title." ? t(key) : fallback;
    document.title =
      translated && translated !== key ? translated : `DMR Poultry - ${fallback}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, language]);

  // Reading the header must not initialize unrelated collection/sales APIs.
  // Cache updates stay reactive; download alerts only when explicitly opened.
  const pendingCollections = useSyncExternalStore(subscribePendingCollectionSnapshot, getPendingCollectionSnapshot, getPendingCollectionSnapshot);
  const pendingApprovals = usePendingApprovals();

  // Single app-wide poller for pending approval counts (bell + sidebar
  // badges). Owner-only: an entry-only role must not pull approval queues
  // (payment/rate/collection values) over the network at all.
  useEffect(() => (canApproveAnything ? startApprovalPolling() : undefined), [canApproveAnything]);
  const [notificationPhase, setNotificationPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const notificationRead = useRef(false);
  const notificationMounted = useRef(false);
  useEffect(() => {
    notificationMounted.current = true;
    return () => { notificationMounted.current = false; };
  }, []);
  const loadCollectionNotifications = useCallback(() => {
    if (pendingCollections.loaded || notificationRead.current) return;
    notificationRead.current = true;
    setNotificationPhase('loading');
    void import("../../modules/operations/collections/services/collectionService")
      .then(({ primeCollectionCache }) => primeCollectionCache())
      .then(() => { if (notificationMounted.current) setNotificationPhase('idle'); })
      .catch(() => { if (notificationMounted.current) setNotificationPhase('error'); })
      .finally(() => { notificationRead.current = false; });
  }, [pendingCollections.loaded]);

  /* ----- Live trip / permit alerts (API only — no localStorage) ----- */
  const [opsAlerts, setOpsAlerts] = useState<NotificationItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const nowLabel = formatRelativeTime(new Date());
    void (async () => {
      const items: NotificationItem[] = [];
      try {
        const trips = await listTrips();
        if (cancelled) return;
        const inProgress = trips.filter((trip) => {
          const status = String(trip.status ?? "");
          return status === "Pending" || status === "Draft" || status === "In Progress";
        });
        if (inProgress.length > 0) {
          items.push({
            id: "trips-in-progress",
            icon: Truck,
            tone: "info",
            title: t("header.tripsInProgress", { count: inProgress.length }),
            description:
              inProgress
                .slice(0, 2)
                .map((trip) => trip.vehicleNo)
                .filter(Boolean)
                .join(", ") + (inProgress.length > 2 ? " …" : ""),
            time: nowLabel,
            path: "/operations?tab=trip-list",
          });
        }
      } catch {
        /* API unavailable — skip trip alerts */
      }
      try {
        const summary = await permitApi.summary();
        if (cancelled) return;
        const expiring = Object.values(summary.byType ?? {}).reduce(
          (sum, bucket) => sum + (bucket?.expiring ?? 0),
          0,
        );
        if (expiring > 0) {
          items.push({
            id: "documents-expiring",
            icon: ShieldAlert,
            tone: "warning",
            title: t("header.documentsExpiring", { count: expiring }),
            description: `${expiring} document(s) expire within 30 days`,
            time: nowLabel,
            path: "/fleet?tab=permits",
          });
        }
      } catch {
        /* API unavailable — skip permit alerts */
      }
      if (!cancelled) setOpsAlerts(items);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, language, t]);

  /* ----- Data-driven notifications (collections snapshot + live ops alerts) -----
     Role-scoped: the bell only ever shows items that belong to the signed-in
     role. Approval queues and money summaries (overdue/pending ₹ totals) are
     OWNER business — a supervisor's bell stays limited to their own work
     (trips on the road, fleet documents expiring). */
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    try {
      if (canApproveAnything) {
        const pending = pendingCollections.items;
        const overdue = pending.filter((p) => p.overdueDays > 0);
        const totalPending = pending.reduce((sum, p) => sum + (p.currentPending || 0), 0);
        if (overdue.length > 0) {
          items.push({
            id: "overdue-collections",
            icon: ShieldAlert,
            tone: "danger",
            title: t("header.overdueCollections", { count: overdue.length }),
            description: t("header.overdueCollectionDesc", {
              amount: formatINR(overdue.reduce((s, p) => s + (p.currentPending || 0), 0)),
            }),
            time: formatRelativeTime(new Date()),
            path: "/operations?tab=pending-collections",
          });
        } else if (pending.length > 0) {
          items.push({
            id: "pending-collections",
            icon: Clock3,
            tone: "info",
            title: t("header.pendingCollectionsTitle", { count: pending.length }),
            description: t("header.pendingCollectionsDesc", { amount: formatINR(totalPending) }),
            time: formatRelativeTime(new Date()),
            path: "/operations?tab=pending-collections",
          });
        }
      }
      items.push(...opsAlerts);
    } catch {
      /* snapshot unavailable — skip collection notifications */
    }
    return items;
  }, [language, pendingCollections, canApproveAnything, opsAlerts, t]);

  /* ----- Pending-approval notifications (trips · bills · rates · payments · leaves) ----- */
  const approvalNotifications = useMemo<NotificationItem[]>(() => {
    // Approval queues exist for the role that approves — never for the
    // entry-only role, whose data the queues also summarize.
    if (!canApproveAnything || !pendingApprovals.loaded) return [];
    const now = formatRelativeTime(new Date());
    const items: NotificationItem[] = [];
    const q = pendingApprovals;
    if (q.trips.count > 0) {
      items.push({
        id: "approval-trips",
        icon: Truck,
        tone: "warning",
        title: `${q.trips.count} trip${q.trips.count === 1 ? "" : "s"} waiting for approval`,
        description: `${q.trips.items.map((i) => i.ref).slice(0, 2).join(", ")}${q.trips.count > 2 ? " …" : ""} · ${q.trips.birds.toLocaleString("en-IN")} birds`,
        time: now,
        path: "/operations?tab=trip-entry&status=Pending",
      });
    }
    if (q.maintenance.count > 0) {
      items.push({
        id: "approval-maintenance",
        icon: Wrench,
        tone: "warning",
        title: `${q.maintenance.count} maintenance bill${q.maintenance.count === 1 ? "" : "s"} to verify`,
        description: `Bill rates pending · ${formatINR(q.maintenance.value)} · ${q.maintenance.items.map((i) => i.ref).slice(0, 2).join(", ")}${q.maintenance.count > 2 ? " …" : ""}`,
        time: now,
        path: "/fleet?tab=entry",
      });
    }
    if (q.rateEntries.count > 0) {
      items.push({
        id: "approval-rates",
        icon: ReceiptText,
        tone: "info",
        title: `${q.rateEntries.count} completed trip${q.rateEntries.count === 1 ? "" : "s"} need rate entry`,
        description: q.rateEntries.items.map((i) => i.ref).slice(0, 2).join(", ") + (q.rateEntries.count > 2 ? " …" : ""),
        time: now,
        path: "/operations?tab=rate-entry",
      });
    }
    if (q.payments.count > 0) {
      items.push({
        id: "approval-payments",
        icon: Banknote,
        tone: "warning",
        title: `${q.payments.count} payment${q.payments.count === 1 ? "" : "s"} to approve`,
        description: `${formatINR(q.payments.value)} awaiting sign-off · ${q.payments.items.map((i) => i.sub).slice(0, 2).join(", ")}${q.payments.count > 2 ? " …" : ""}`,
        time: now,
        path: "/accounts?tab=paid-payments",
      });
    }
    if (q.leaves.count > 0) {
      items.push({
        id: "approval-leaves",
        icon: CalendarDays,
        tone: "warning",
        title: `${q.leaves.count} leave request${q.leaves.count === 1 ? "" : "s"} to approve`,
        description: `${q.leaves.items.map((i) => i.ref).slice(0, 2).join(", ")}${q.leaves.count > 2 ? " …" : ""}`,
        time: now,
        path: PENDING_LEAVES_PATH,
      });
    }
    return items;
  }, [pendingApprovals, canApproveAnything]);

  // Approval alerts lead the bell; operational alerts follow. Every row must
  // also lead somewhere the signed-in role may open — a supervisor never sees
  // "waiting for approval" nudges or links into blocked sections.
  const allNotifications = useMemo(
    () =>
      [...approvalNotifications, ...notifications]
        .filter((n) => canAccessNavPath(user?.role, n.path)),
    [approvalNotifications, notifications, user?.role]
  );
  // Bell badge counts every waiting record (not just the grouped rows) for
  // approvers; other roles count only the operational rows they can open.
  const notificationBadge = pendingApprovals.loaded && canApproveAnything
    ? pendingApprovals.total + notifications.length
    : allNotifications.length;

  // Every level falls back through its i18n key first: a section-level match
  // (no page) must still read its translated label, never the raw English one.
  const title = route.page?.labelKey
    ? t(route.page.labelKey)
    : (route.page?.label ??
      (route.section?.labelKey ? t(route.section.labelKey) : route.section?.label) ??
      "");
  const sectionLabel = route.section?.labelKey ? t(route.section.labelKey) : route.section?.label;

  // The collapsible group the current row sits in, if any ("orders" → "Orders").
  const group = route.page?.group ? NAV_CHILD_GROUPS[route.page.group] : undefined;
  const groupLabel = group ? (group.labelKey ? t(group.labelKey) : group.label) : undefined;
  // The group crumb lands on the module's own first page, so "Orders" always
  // opens Collection — never whichever page happens to be open.
  const groupPath = route.section?.children.find(
    (child) => child.group === route.page?.group
  )?.path;


  return (
    <header
      className={`dmr-app-header sticky top-0 ${viewOpen ? "z-[55]" : "z-40"} flex h-16 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:gap-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900/85`}
    >
      {/* Menu — every viewport, because it is the way back to a collapsed or
          hidden sidebar. Below `lg` it opens the floating popup; from `lg` up
          it steps the persistent panel (see DashboardLayout), so it must never
          be hidden on desktop. */}
      <button
        type="button"
        onClick={onMenuClick}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          menuOpen
            ? "bg-slate-200/80 text-slate-900 dark:bg-slate-700/80 dark:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        }`}
        aria-label={t("header.toggleNav")}
        aria-expanded={menuOpen}
      >
        <Menu size={20} />
      </button>

      {/* Neat Single-Line Breadcrumb & Page Title */}
      <div className="min-w-0 flex-1 flex items-center">
        {sectionLabel && route.page && (
          <>
            <Link
              to={route.section?.children[0]?.path ?? "/dashboard"}
              className="hidden truncate text-[15px] font-medium text-slate-500 transition-colors hover:text-slate-800 sm:block dark:text-slate-400 dark:hover:text-slate-200"
            >
              {sectionLabel}
            </Link>
            <ChevronRight size={16} className="hidden mx-2 shrink-0 text-slate-400 sm:block dark:text-slate-600" />
            {groupLabel && (
              <>
                {/* Sub-modules get their own crumb, so an Orders page reads
                    "Operations › Orders › Collection" — the same three levels
                    the sidebar shows, and it keeps a short row name ("Collection")
                    unambiguous. */}
                <Link
                  to={groupPath ?? route.section?.children[0]?.path ?? "/dashboard"}
                  className="hidden truncate text-[15px] font-medium text-slate-500 transition-colors hover:text-slate-800 sm:block dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {groupLabel}
                </Link>
                <ChevronRight size={16} className="hidden mx-2 shrink-0 text-slate-400 sm:block dark:text-slate-600" />
              </>
            )}
          </>
        )}
        <h1 className="truncate text-[16px] font-semibold tracking-tight text-slate-900 sm:text-[17px] dark:text-white">
          {title || "DMR Poultry"}
        </h1>
      </div>

      {/* Global search — opens the command palette */}
      <button
        type="button"
        onClick={onOpenCommand}
        className="hidden h-9 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 pl-3 pr-2 text-sm text-slate-400 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-500 md:flex md:w-56 lg:w-64 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      >
        <Search size={15} />
        <span className="flex-1 text-left">{t("header.search")}</span>
        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
          ⌘K
        </kbd>
      </button>
      <IconButton label={t("header.search_short")} onClick={onOpenCommand} className="dmr-header-search-mobile md:hidden">
        <Search size={18} />
      </IconButton>

      {/* Theme toggle is intentionally hidden; ThemeProvider and this guarded
          control stay in place so the existing implementation can return later. */}
      {SHOW_THEME_CONTROLS ? (
        <IconButton label={theme === "dark" ? t("header.theme_light") : t("header.theme_dark")} onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
      ) : null}

      {/* Global UI scale sits immediately beside language. */}
      <FontScaleControl />
      <LanguageSwitcher />

      {/* Notifications */}
      <Dropdown
        width="w-[360px] max-w-[calc(100vw-2rem)]"
        trigger={(open, toggle) => (
          <IconButton label={t("header.notifications")} onClick={() => { toggle(); if (!open && canApproveAnything) loadCollectionNotifications(); }} badge={notificationBadge}>
            <Bell size={18} />
          </IconButton>
        )}
      >
        {(close) => (
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t("header.notifications")}</p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {notificationBadge} {t("header.new")}
              </span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {!pendingCollections.loaded && notificationPhase === 'loading' && (
                <p role="status" className="px-4 py-6 text-center text-xs text-slate-500">{t("header.loadingNotifications")}</p>
              )}
              {!pendingCollections.loaded && notificationPhase === 'error' && (
                <div role="alert" className="px-4 py-5 text-center text-xs text-amber-700">
                  <p>{t("header.notificationsUnavailable")}</p>
                  <button type="button" onClick={loadCollectionNotifications} className="mt-2 rounded-lg px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50">{t("common.retry")}</button>
                </div>
              )}
              {allNotifications.length === 0 ? (pendingCollections.loaded ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">
                    <Check size={18} />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t("header.noNotifications")}</p>
                  <p className="text-xs text-slate-400">{t("header.noNotificationsDesc")}</p>
                </div>
              ) : null) : (
                allNotifications.map((n) => {
                  const Icon = n.icon;
                  return (
                  <Link
                    key={n.id}
                    to={n.path}
                    onClick={close}
                    className="flex items-start gap-3 border-b border-slate-50 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/40"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        n.tone === "danger"
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                          : n.tone === "warning"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                          : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {n.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{n.description}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-slate-400 dark:text-slate-500">{n.time}</span>
                    </span>
                  </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Dropdown>

      {/* Quick actions */}
      <Dropdown
        width="w-72"
        trigger={(open, toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="hidden h-9 items-center gap-1.5 rounded-lg bg-brand-600 pl-3 pr-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 sm:flex dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Plus size={16} />
            {t("header.quickAdd")}
            <ChevronDown size={14} className={`text-brand-200 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      >
        {(close) => (
          <div className="p-1.5">
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("header.quickActions")}
            </p>
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.path}
                onClick={close}
                className="flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <action.icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {action.labelKey ? t(action.labelKey) : action.label}
                  </span>
                  <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                    {action.descriptionKey ? t(action.descriptionKey) : action.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Dropdown>

      {/* Profile */}
      <div className="dmr-header-profile shrink-0">
      <Dropdown
        width="w-64"
        trigger={(open, toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-xs font-bold text-white ring-2 ring-white dark:ring-slate-800">
              {initials}
            </span>
            <span className="hidden text-left xl:block">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                {displayName}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {roleLabel(displayRole)}
              </span>
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      >
        {(close) => (
          <div className="p-1.5">
            <div className="flex items-center gap-3 rounded-lg px-2.5 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-sm font-bold text-white">
                {initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{displayName}</span>
                <span className="block truncate text-xs text-slate-400">{user?.username ? `@${user.username}` : ""}</span>
              </span>
            </div>
            <div className="mx-2.5 my-1.5 flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 dark:bg-slate-700/40">
              <UserRound size={13} className="text-brand-600 dark:text-brand-400" />
              <span className="text-[11.5px] font-medium text-slate-500 dark:text-slate-300">{t("header.role")}</span>
              <span className="ml-auto rounded-full bg-brand-100 px-2 py-px text-[10.5px] font-semibold text-brand-800 dark:bg-brand-500/15 dark:text-brand-300">
                {roleLabel(displayRole)}
              </span>
            </div>
            <div className="my-1.5 h-px bg-slate-100 dark:bg-slate-700" />
            {settingsAllowed && (
              <Link
                to="/settings?tab=profile"
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <Settings size={15} /> {t("header.settings")}
              </Link>
            )}
            {(user?.role === "OWNER" || user?.role === "FULL_ACCESS") && (
              <Link
                to="/settings?tab=access"
                onClick={close}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
              >
                <UserRound size={15} /> Access Management
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                close();
                setChangePasswordOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
            >
              <KeyRound size={15} /> {t("auth.password.title")}
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                setMfaOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
            >
              <ShieldCheck size={15} /> Two-factor authentication
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                handleSignOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut size={15} /> {t("auth.signout")}
            </button>
          </div>
        )}
      </Dropdown>
      </div>
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      <MfaSettingsDialog open={mfaOpen} onClose={() => setMfaOpen(false)} />
    </header>
  );
}

export default Header;
