import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban as BanIcon,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  History,
  History as HistoryColor,
  KeyRound,
  KeyRound as KeyRoundColor,
  PauseCircle,
  PauseCircle as PauseSolid,
  PlayCircle,
  RotateCcw,
  Search,
  Check,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { apiClient } from "../../../api/client";
import { useAuth } from "../../../providers/authContext";
import { useI18n } from "../../../i18n";
import { useSafeNotification } from "../../../hooks/useSafeNotification";
import Modal from "../../../ui/Modal";
import Pagination from "../../../ui/Pagination";
import { BrandRefreshButton } from "../../../ui/BrandRefreshButton";
import { opsInputClass } from "../../../shared/ui/operationsStyles";
import { ActionTooltip } from "../../../ui/ActionTooltip";
import MasterDropdown from "../../masters/components/MasterDropdown";
import { PAGINATION_DEFAULT_PAGE_SIZE } from "../../../shared/ui/uiTokens";
import { shouldShowPagination } from "../../../shared/ui/paginationStyles";

/**
 * Copy with confirmation feedback. Writes the secret to the clipboard, then
 * flashes "Copied!" (check icon + label swap) for a moment so the owner can
 * SEE the copy happened. Falls back to a hidden textarea + execCommand when
 * the async clipboard API is unavailable (http origins, older browsers).
 */
function useCopyFlash() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);
  const copy = useCallback(async (value: string) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch { /* fall through to the legacy path */ }
    if (!ok) {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      area.remove();
    }
    if (!ok) return false;
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
    return true;
  }, []);
  return { copied, copy };
}

/** Copy button with animated confirmation (check icon swap + tooltip). */
function CopyPasswordButton({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopyFlash();
  return (
    <button
      type="button"
      onClick={() => void copy(value)}
      className={`group relative grid h-8 w-8 place-items-center rounded-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-90 ${
        copied
          ? "bg-emerald-50 text-emerald-600"
          : "text-rose-500 hover:bg-rose-50"
      }`}
    >
      <span
        aria-hidden
        className={`grid place-items-center transition-all duration-200 motion-safe:animate-[var(--animate-action-pop)] ${copied ? "scale-0 opacity-0 absolute" : "scale-100 opacity-100"}`}
      >
        <Copy size={14} />
      </span>
      <span
        aria-hidden
        className={`grid place-items-center transition-all duration-200 ${copied ? "scale-100 opacity-100" : "scale-0 opacity-0 absolute"}`}
      >
        <Check size={14} strokeWidth={3} className="motion-safe:animate-[var(--animate-action-pop)]" />
      </span>
      <ActionTooltip label={copied ? "Copied!" : label} side="bottom" />
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}

/** One row of the employee access directory. */
type AccessRow = {
  employee_id: number;
  employee_no: number;
  employee_name: string;
  department: string | null;
  phone_number: string | null;
  employee_status: string;
  user_id: number | null;
  username: string | null;
  role: string | null;
  access_status: string;
  last_login_at: string | null;
  last_password_reset_at: string | null;
  must_change_password: boolean | null;
  mfa_enabled: boolean | null;
};

/**
 * Counts for the WHOLE filtered directory, not just the visible page — the KPI
 * strip and the table therefore always agree, no matter which page is open.
 */
type AccessSummary = {
  total: number;
  active: number;
  paused: number;
  revoked: number;
  notGranted: number;
  passwordChanged: number;
  mustChangePassword: number;
  mfaEnabled: number;
  /** Active users whose password is older than the 90-day policy. */
  expired?: number;
  lastPasswordChangeAt: string | null;
};

type HistoryRow = Record<string, unknown>;
type DialogState =
  | { kind: "grant"; row?: AccessRow }
  | { kind: "secret"; row?: AccessRow }
  | { kind: "pause" | "resume" | "revoke" | "reset"; row: AccessRow }
  | { kind: "login-history" | "security-history"; row: AccessRow }
  | null;

/** The directory lists only granted logins by default — NOT_GRANTED employees
 *  are handled through the header Grant Access flow instead of the table. */
const DEFAULT_ACCESS_FILTER = "ACTIVE,PAUSED";
const ROLES = ["FULL_ACCESS", "AUDIT", "OFFICE", "COLLECTION", "SUPERVISOR"];
const ACCESS_STATUSES = ["ACTIVE", "PAUSED", "REVOKED"];

/** Visual identity for each mutating action — drives the confirm dialog. */
const confirmTone: Record<string, { button: string; icon: typeof ShieldCheck }> = {
  pause: {
    button: "from-amber-500 to-orange-500 shadow-amber-500/25 hover:shadow-amber-500/40 focus-visible:ring-amber-500/60",
    icon: PauseCircle,
  },
  resume: {
    button: "from-emerald-600 to-teal-600 shadow-emerald-500/25 hover:shadow-emerald-500/40 focus-visible:ring-emerald-500/60",
    icon: PlayCircle,
  },
  revoke: {
    button: "from-rose-500 to-red-600 shadow-rose-500/25 hover:shadow-rose-500/40 focus-visible:ring-rose-500/60",
    icon: BanIcon,
  },
  reset: {
    button: "from-violet-600 to-purple-600 shadow-violet-500/25 hover:shadow-violet-500/40 focus-visible:ring-violet-500/60",
    icon: KeyRound,
  },
};

/** Days elapsed since the last password reset — rendered as a maturity chip. */
const daysSince = (value: unknown) => {
  if (!value) return null;
  const ms = Date.now() - new Date(String(value)).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.floor(ms / 86_400_000) : null;
};

const fmt = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("en-IN") : "—";

/** Column header cell — colored icon + label, exactly the Trip List / Shop Sales
 *  master-table header language. `center` centers the label over the column. */
const Th = ({ icon, tone, children, center }: { icon: React.ReactNode; tone: string; children: React.ReactNode; center?: boolean }) => (
  <th scope="col" className={`px-3 py-3 font-semibold whitespace-nowrap ${center ? "text-center" : ""}`}>
    <span className={`flex items-center gap-1.5 ${center ? "justify-center" : ""}`}>
      <span className={`shrink-0 ${tone}`}>{icon}</span>
      {children}
    </span>
  </th>
);

/** Compact KPI chip — icon, value, tiny label, all inline; never wraps. */
const Kpi = ({ icon, tone, value, label, delay = 0 }: { icon: React.ReactNode; tone: string; value: React.ReactNode; label: string; delay?: number }) => (
  <span
    className={`animate-fade-in inline-flex items-center gap-1.5 rounded-lg border bg-white/80 px-2.5 py-1 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tone}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <span className="shrink-0 opacity-80">{icon}</span>
    <span className="text-sm font-extrabold leading-none tabular-nums">{value}</span>
    <span className="text-[10px] font-bold uppercase leading-none opacity-70">{label}</span>
  </span>
);

/** Event-type badges for the history modals — one tone per event family. */
const eventBadgeTone: Record<string, string> = {
  LOGIN_SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOGIN_FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  LOGOUT: "bg-slate-100 text-slate-600 ring-slate-200",
  ACCESS_GRANTED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACCESS_REVOKED: "bg-rose-50 text-rose-700 ring-rose-200",
  ACCESS_PAUSED: "bg-amber-50 text-amber-700 ring-amber-200",
  ACCESS_RESUMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ROLE_CHANGED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  PASSWORD_RESET: "bg-violet-50 text-violet-700 ring-violet-200",
  PASSWORD_CHANGED: "bg-violet-50 text-violet-700 ring-violet-200",
  MFA_ENABLED: "bg-sky-50 text-sky-700 ring-sky-200",
  MFA_DISABLED: "bg-rose-50 text-rose-700 ring-rose-200",
  SESSION_INVALIDATED: "bg-amber-50 text-amber-700 ring-amber-200",
};

const eventBadge = (event: unknown) => {
  const key = String(event ?? "").toUpperCase();
  const tone = eventBadgeTone[key] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ring-1 ring-inset ${tone}`}>
      {key.replace(/_/g, " ")}
    </span>
  );
};

/** Formatted details: one "key: value" line per JSON field; raw strings pass
 *  through. Replaces the unreadable JSON.stringify blob. */
const formatDetails = (details: unknown): string => {
  if (details == null) return "—";
  if (typeof details === "string") return details;
  if (typeof details !== "object") return String(details);
  const lines = Object.entries(details as Record<string, unknown>).map(([key, value]) => {
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
    const text =
      value === null || value === undefined || value === ""
        ? "—"
        : typeof value === "boolean"
          ? value ? "yes" : "no"
          : String(value);
    return `${label}: ${text}`;
  });
  return lines.length > 0 ? lines.join("\n") : "—";
};

const statusBadge = (value: string) => {
  const tone =
    value === "ACTIVE" || value === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : value === "PAUSED" || value === "Suspended"
        ? "bg-amber-50 text-amber-700"
        : value === "REVOKED" || value === "Inactive"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-600";
  return `inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${tone}`;
};

const rowActions = (row: AccessRow, editable: boolean, actorRole?: string) => {
  if (!editable || !row.user_id) return false;
  if (row.role === "OWNER" || (actorRole !== "OWNER" && row.role === "FULL_ACCESS")) return false;
  return !["REVOKED", "NOT_GRANTED"].includes(row.access_status);
};

/**
 * Employee access directory — the Settings page's main list.
 *
 * Rendered in the Trip List card rhythm: gradient header strip, filter bar,
 * KPI strip, master table, and ONE global pagination bar at the bottom that
 * pages the whole directory through the server (page/pageSize travel to the
 * API; the client never slices).
 */
export default function AccessManagement() {
  const { t } = useI18n();
  const { user } = useAuth();
  const editable = user?.role === "OWNER" || user?.role === "FULL_ACCESS";
  const assignableRoles = user?.role === "OWNER" ? ROLES : ROLES.filter((roleName) => roleName !== "FULL_ACCESS");
  const { showNotification } = useSafeNotification();

  const [rows, setRows] = useState<AccessRow[]>([]);
  const [summary, setSummary] = useState<AccessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGINATION_DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [access, setAccess] = useState(DEFAULT_ACCESS_FILTER);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  /** Rows whose masked password is revealed — OWNER/FULL_ACCESS only, one row at a time. */
  /** Employee password revealed after the owner re-authenticated — id → secret. */
  const [revealed, setRevealed] = useState<number | null>(null);
  const [revealedSecret, setRevealedSecret] = useState("");
  /** Owner re-authentication popup: { row } while asking for login password. */
  const [revealAsk, setRevealAsk] = useState<{ row: AccessRow } | null>(null);
  const [actorPassword, setActorPassword] = useState("");
  const [revealInputReady, setRevealInputReady] = useState(false);
  const [revealBusy, setRevealBusy] = useState(false);
  const [eligible, setEligible] = useState<HistoryRow[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("SUPERVISOR");
  const [secret, setSecret] = useState("");

  // Only the newest request may write state: rapid filter changes must never
  // let a slow earlier response overwrite a newer one.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    try {
      const { data } = await apiClient.get("/access-management/employees", {
        params: {
          page,
          pageSize,
          search,
          role: role || undefined,
          accessStatus: access || undefined,
        },
      });
      if (seq !== requestSeq.current) return;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(Number(data.total ?? 0));
      setSummary(data.summary ?? null);
    } catch {
      if (seq === requestSeq.current) {
        showNotification(t("settings.access_load_failed"), "error");
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [page, pageSize, search, role, access, showNotification, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const hasFilters = Boolean(search.trim() || role || access);

  const resetFilters = () => {
    setSearch("");
    setRole("");
    setAccess("");
    setPage(1);
  };

  const openGrant = async (row?: AccessRow) => {
    try {
      const { data } = await apiClient.get("/access-management/eligible-employees");
      setEligible(Array.isArray(data.rows) ? data.rows : []);
      setSelectedEmployee(row ? String(row.employee_id) : "");
      setEmployeeQuery("");
      setSelectedRole(row?.role ?? "SUPERVISOR");
      setDialog({ kind: "grant", row });
    } catch {
      showNotification(t("settings.access_eligible_failed"), "error");
    }
  };

  const mutate = async (kind: string, row?: AccessRow) => {
    if (!editable || !row?.user_id) return;
    try {
      if (kind === "reset") {
        const { data } = await apiClient.post(`/access-management/${row.user_id}/reset-password`);
        setSecret(String(data.temporaryPassword ?? ""));
        setDialog({ kind: "secret", row });
      } else {
        await apiClient.post(`/access-management/${row.user_id}/access`, { action: kind.toUpperCase() });
        setDialog(null);
        showNotification(
          t("settings.access_status_updated", { action: kind.toUpperCase() }),
          "success",
        );
      }
      await load();
    } catch {
      showNotification(t("settings.access_update_failed"), "error");
    }
  };

  const grant = async () => {
    try {
      const { data } = await apiClient.post("/access-management/grant", {
        employeeId: Number(selectedEmployee),
        role: selectedRole,
      });
      setSecret(String(data.temporaryPassword ?? ""));
      setDialog({ kind: "secret" });
      showNotification(t("settings.access_granted"), "success");
      await load();
    } catch {
      showNotification(t("settings.access_grant_failed"), "error");
    }
  };

  const openHistory = async (kind: "login" | "security", row: AccessRow) => {
    if (!row.user_id) return;
    setDialog({ kind: `${kind}-history` as "login-history" | "security-history", row });
    setHistory([]);
    try {
      const { data } = await apiClient.get(`/access-management/${row.user_id}/${kind}-history`);
      setHistory(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      showNotification(t("settings.access_history_failed"), "error");
    }
  };

  const close = () => {
    setSecret("");
    setDialog(null);
    setRevealAsk(null);
    setActorPassword("");
    setRevealInputReady(false);
  };

  /** Revealed passwords hide themselves after 10 seconds — the owner had
   *  their moment to read/copy it; the secret never lingers on screen. */
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRevealHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setRevealed(null);
      setRevealedSecret("");
      hideTimer.current = null;
    }, 10_000);
  }, []);
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  /** Owner-only: verify the owner's login password server-side, then the
   *  backend issues a fresh working password for the employee which is shown
   *  in place of the mask. */
  const revealPassword = async () => {
    const row = revealAsk?.row;
    if (!row?.user_id || !actorPassword) return;
    setRevealBusy(true);
    try {
      const { data } = await apiClient.post(`/access-management/${row.user_id}/reveal-password`, {
        actorPassword,
      });
      setRevealed(row.employee_id);
      setRevealedSecret(String(data.password ?? ""));
      setRevealAsk(null);
      setActorPassword("");
      startRevealHideTimer();
      await load();
    } catch {
      showNotification(t("settings.access_reveal_failed"), "error");
    } finally {
      setRevealBusy(false);
    }
  };

  const filterSelects = [
    { key: "role", value: role, set: setRole, label: "Role", options: ROLES },
    { key: "access", value: access, set: setAccess, label: "Access", options: ACCESS_STATUSES },
  ];

  const matchingEligible = eligible.filter((employee) => {
    const haystack = `${String(employee.employee_name ?? "")} ${String(employee.employee_no ?? "")} ${String(employee.department ?? "")} ${String(employee.phone_number ?? "")}`.toLowerCase();
    return haystack.includes(employeeQuery.trim().toLowerCase());
  });

  return (
    <section
      aria-labelledby="access-title"
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-xs shadow-sm md:text-sm"
    >
      {/* Header — deliberately the same strip as the Trip List card, entering
          with the same fade-in rhythm as the Personal information tiles. */}
      <div className="animate-fade-in flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 via-white to-indigo-50/40 px-6 py-3" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50/70 text-indigo-500 shadow-inner">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 id="access-title" className="text-base font-bold tracking-tight text-slate-800">
              {t("settings.access_management")}
            </h2>
            {/* Three directory chips directly under the name. */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Kpi icon={<Users size={12} />} tone="border-slate-200 text-slate-700" value={summary?.total ?? 0} label={t("settings.access_kpi_total")} delay={60} />
              <Kpi icon={<ShieldCheck size={12} />} tone="border-emerald-200 bg-emerald-50/60 text-emerald-700" value={summary?.active ?? 0} label={t("settings.access_kpi_active")} delay={105} />
              <Kpi icon={<PauseSolid size={12} />} tone="border-amber-200 bg-amber-50/60 text-amber-700" value={summary?.paused ?? 0} label={t("settings.access_kpi_paused")} delay={150} />
            </div>
          </div>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => void openGrant()}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <UserCheck size={14} />
            {t("settings.access_grant")}
          </button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Password-expiry policy banner — only when active users carry a
            password older than 90 days; each offender gets a one-click reset. */}
        {(() => {
          const expiredRows = rows.filter(
            (row) =>
              row.user_id &&
              row.access_status === "ACTIVE" &&
              (daysSince(row.last_password_reset_at) ?? Infinity) > 90,
          );
          const expiredCount = summary?.expired ?? (expiredRows.length || 0);
          if (expiredCount === 0 || !editable) return null;
          return (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50/80 via-white to-white px-3.5 py-2.5 shadow-sm"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500">
                <AlertTriangle size={16} strokeWidth={2.2} />
              </span>
              <p className="min-w-0 flex-1 text-xs font-bold text-rose-700">
                {t("settings.access_expiry_title", {
                  count: expiredCount,
                  s: expiredCount === 1 ? "" : "s",
                })}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {expiredRows.map((row) => (
                  <button
                    key={`expired-${row.employee_id ?? row.user_id}`}
                    type="button"
                    onClick={() => setDialog({ kind: "reset", row })}
                    className="group inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md hover:shadow-rose-500/15 active:translate-y-0 active:scale-95"
                  >
                    <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><KeyRound size={12} /></span>
                    <span className="max-w-[140px] truncate">{row.employee_name}</span>
                    <span className="opacity-60">·</span>
                    {t("settings.access_expiry_action")}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filter bar — icon-led search first, then the selects; the text
            label is gone, the magnifier alone says "search". */}
        <div className="animate-fade-in flex flex-wrap items-end gap-2" style={{ animationDelay: "120ms" }}>
          <div className="min-w-[210px] flex-1">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder={t("common.search")}
                aria-label={t("common.search")}
                className={`${opsInputClass} pl-10`}
              />
            </div>
          </div>
          {filterSelects.map((filter) => (
            <MasterDropdown
              key={filter.key}
              hideLabel
              label={`${filter.label} filter`}
              value={filter.value === DEFAULT_ACCESS_FILTER ? "" : filter.value}
              onChange={(value) => {
                setPage(1);
                filter.set(value || DEFAULT_ACCESS_FILTER);
              }}
              options={filter.options.map((option) => ({ value: option, label: option.replace(/_/g, " ") }))}
              placeholder={`All ${filter.label}`}
              searchable
              allowClear
              className="min-w-[150px]"
            />
          ))}
          <BrandRefreshButton loading={loading} onClick={() => void load()} />
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="group inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-sm active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
            >
              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-reset)]"><RotateCcw size={13} strokeWidth={2.4} /></span>
              {t("common.reset")}
            </button>
          )}
        </div>

        {/* Master table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[1060px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
              <tr>
                <Th icon={<UserCheck size={13} />} tone="text-emerald-500">{t("settings.access_col_employee")}</Th>
                <Th icon={<ShieldCheck size={13} />} tone="text-indigo-500" center>{t("settings.access_col_role")}</Th>
                <Th icon={<UserCheck size={13} />} tone="text-sky-500" center>{t("settings.access_col_username")}</Th>
                <Th icon={<KeyRoundColor size={13} />} tone="text-violet-500" center>{t("settings.access_col_password")}</Th>
                <Th icon={<ShieldCheck size={13} />} tone="text-amber-500" center>Access</Th>
                <Th icon={<HistoryColor size={13} />} tone="text-rose-500" center>{t("settings.access_col_last_login")}</Th>
                <Th icon={<UserCheck size={13} />} tone="text-emerald-500" center>{t("settings.access_col_actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="px-3 py-2">
                      <div className="h-7 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-slate-500">
                    {hasFilters ? t("settings.access_empty_filtered") : t("settings.access_empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`access-${row.employee_id ?? row.user_id}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold text-slate-800 dark:text-slate-100">{row.employee_name}</span>
                      <span className="mt-0.5 block text-[11px] font-medium uppercase text-slate-500">
                        {row.department || "Department not assigned"} - {row.employee_no}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <div className="flex justify-center whitespace-nowrap">
                        {rowActions(row, editable, user?.role) ? (
                          <MasterDropdown
                            hideLabel
                            label={`Role for ${row.employee_name}`}
                            value={row.role ?? "SUPERVISOR"}
                            onChange={async (value) => {
                              try {
                                await apiClient.patch(`/access-management/${row.user_id}/role`, { role: value });
                                showNotification(t("settings.access_role_updated"), "success");
                                await load();
                              } catch {
                                showNotification(t("settings.access_update_failed"), "error");
                              }
                            }}
                            options={assignableRoles.map((option) => ({ value: option, label: option.replace(/_/g, " ") }))}
                            className="w-[112px]"
                            triggerClassName="h-8 px-2 text-[11px]"
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">{(row.role ?? "Not assigned").replace(/_/g, " ")}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 text-center align-middle font-medium text-slate-600">{row.username ?? "—"}</td>

                    {/* Password column: mask + gated eye, centred. Revealing
                        requires the owner to re-enter their own login password
                        (backend-verified); the shown secret is a fresh working
                        password issued at reveal time. */}
                    <td className="px-3 align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`inline-block max-w-[220px] rounded font-mono transition-all duration-200 select-all ${
                            revealed === row.employee_id
                              ? "break-all bg-rose-50 px-2 py-0.5 text-[13px] font-bold text-rose-600 ring-1 ring-rose-200"
                              : "px-0.5 text-[11px] tracking-widest text-slate-400"
                          }`}
                        >
                          {revealed === row.employee_id ? revealedSecret || "••••••••" : "••••••••"}
                        </span>
                        {revealed === row.employee_id && revealedSecret && (
                          <CopyPasswordButton value={revealedSecret} label={t("settings.access_copy_password")} />
                        )}
                        {rowActions(row, editable, user?.role) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (revealed === row.employee_id) {
                                setRevealed(null);
                                setRevealedSecret("");
                              } else {
                                setRevealAsk({ row });
                                setActorPassword("");
                              }
                            }}
                            className={`group relative rounded p-1 transition hover:bg-slate-100 ${
                              revealed === row.employee_id ? "text-rose-500" : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {revealed === row.employee_id ? <EyeOff size={14} /> : <Eye size={14} />}
                            <ActionTooltip label={revealed === row.employee_id ? t("settings.access_pw_hide") : t("settings.access_pw_reveal")} side="top" className="whitespace-nowrap" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-3 text-center align-middle">
                      <span className={statusBadge(row.access_status)}>
                        {row.access_status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 text-center align-middle text-slate-600">{fmt(row.last_login_at)}</td>
                    <td className="px-3 align-middle">
                      <div className="relative z-0 flex items-center justify-center gap-1.5 [&>button]:z-0 [&>button:hover]:z-20 [&>button:focus-visible]:z-20">
                        {rowActions(row, editable, user?.role) && (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "reset", row })}
                            className="group relative inline-flex items-center gap-1 rounded-lg bg-violet-50/80 p-1.5 text-violet-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-100 hover:shadow-sm hover:shadow-violet-500/20 active:translate-y-0 active:scale-95"
                          >
                            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><KeyRound size={14} /></span>
                            <ActionTooltip label={t("settings.access_change")} side="top" className="whitespace-nowrap" />
                          </button>
                        )}
                        {rowActions(row, editable, user?.role) && row.access_status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "pause", row })}
                            className="group relative inline-flex items-center gap-1 rounded-lg bg-amber-50/80 p-1.5 text-amber-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-sm hover:shadow-amber-500/20 active:translate-y-0 active:scale-95"
                          >
                            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><PauseCircle size={14} /></span>
                            <ActionTooltip label={t("settings.access_pause")} side="top" className="whitespace-nowrap" />
                          </button>
                        )}
                        {rowActions(row, editable, user?.role) && row.access_status === "PAUSED" && (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "resume", row })}
                            className="group relative inline-flex items-center gap-1 rounded-lg bg-emerald-50/80 p-1.5 text-emerald-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-100 hover:shadow-sm hover:shadow-emerald-500/20 active:translate-y-0 active:scale-95"
                          >
                            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><PlayCircle size={14} /></span>
                            <ActionTooltip label={t("settings.access_resume")} side="top" className="whitespace-nowrap" />
                          </button>
                        )}
                        {rowActions(row, editable, user?.role) && (
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "revoke", row })}
                            className="group relative inline-flex items-center gap-1 rounded-lg bg-rose-50/80 p-1.5 text-rose-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-sm hover:shadow-rose-500/20 active:translate-y-0 active:scale-95"
                          >
                            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={14} strokeWidth={2.5} /></span>
                            <ActionTooltip label={t("settings.access_revoke")} side="top" className="whitespace-nowrap" />
                          </button>
                        )}
                        {row.user_id && (
                          <>
                            <button
                              type="button"
                              onClick={() => void openHistory("login", row)}
                              className="group relative inline-flex rounded-lg bg-sky-50/80 p-1.5 text-sky-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-100 hover:shadow-sm hover:shadow-sky-500/20 active:translate-y-0 active:scale-95"
                            >
                              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-view)]"><History size={14} /></span>
                              <ActionTooltip label={t("settings.access_login_history")} side="top" className="whitespace-nowrap" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void openHistory("security", row)}
                              className="group relative inline-flex rounded-lg bg-indigo-50/80 p-1.5 text-indigo-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-100 hover:shadow-sm hover:shadow-indigo-500/20 active:translate-y-0 active:scale-95"
                            >
                              <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-search)]"><ShieldCheck size={14} /></span>
                              <ActionTooltip label={t("settings.access_security_history")} side="top" className="whitespace-nowrap" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ONE global paginator for the whole directory, server-driven. */}
        {shouldShowPagination(total) && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={total}
            disabled={loading}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
          />
        )}
      </div>

      <Modal
        open={dialog !== null || revealAsk !== null}
        onClose={close}
        size={dialog?.kind?.includes("history") ? "xl" : "md"}
        overlayClassName="backdrop-blur-none"
        closeButtonClassName="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
        title={
          revealAsk ? (
            <span className="inline-flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-rose-50 text-rose-500"><Eye size={17} strokeWidth={2.4} /></span>{t("settings.access_reveal_title")}</span>
          ) : dialog?.kind === "grant"
            ? <span className="inline-flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><UserCheck size={17} strokeWidth={2.4} /></span>{t("settings.access_grant")}</span>
            : dialog?.kind === "secret"
              ? t("settings.access_temp_password")
              : dialog?.kind?.includes("history")
                ? dialog.kind.startsWith("login")
                  ? <span className="inline-flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-500"><History size={17} strokeWidth={2.4} /></span>{t("settings.access_login_history")}</span>
                  : <span className="inline-flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-500"><ShieldCheck size={17} strokeWidth={2.4} /></span>{t("settings.access_security_history")}</span>
                : dialog
                  ? `${dialog.kind[0].toUpperCase()}${dialog.kind.slice(1)} ${t("settings.access_col_access_status")}`
                  : ""
        }
        description={revealAsk ? revealAsk.row.employee_name : dialog?.row?.employee_name}
      >
        {dialog?.kind === "grant" ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700" htmlFor="grant-employee-search">
                <Search size={15} className="text-emerald-500" />
                {t("settings.access_col_employee")}
              </label>
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="grant-employee-search"
                  value={employeeQuery}
                  onChange={(event) => setEmployeeQuery(event.target.value)}
                  placeholder="Search employee, department or mobile"
                  className={`${opsInputClass} pl-9`}
                />
              </div>
              <div className="mt-2 max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-inner">
                {matchingEligible.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-slate-500">No eligible employees found.</p>
                ) : matchingEligible.map((employee) => {
                  const id = String(employee.id);
                  const selected = selectedEmployee === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedEmployee(id)}
                      className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${selected ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{String(employee.employee_name)}</span>
                        <span className="mt-0.5 block truncate text-[11px] uppercase text-slate-500">{String(employee.department || "Department not assigned")} - {String(employee.employee_no)}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-slate-500">{String(employee.phone_number || "No mobile")}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Showing five employees at a time. Scroll for more.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">{t("settings.access_col_role")}</label>
              <MasterDropdown
                hideLabel
                label={t("settings.access_col_role")}
                value={selectedRole}
                onChange={setSelectedRole}
                options={assignableRoles.map((option) => ({ value: option, label: option.replace(/_/g, " ") }))}
                searchable
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={15} strokeWidth={2.4} /></span>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!selectedEmployee}
                onClick={() => void grant()}
                className="group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition-all duration-200 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 hover:before:translate-x-full active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:before:-translate-x-full"
              >
                <span className={`relative z-10 inline-flex ${selectedEmployee ? "motion-safe:group-hover:animate-[var(--animate-action-add)]" : ""}`}><UserCheck size={15} strokeWidth={2.4} /></span>
                <span className="relative z-10">{t("settings.access_grant")}</span>
              </button>
            </div>
          </div>
        ) : dialog?.kind === "secret" ? (
          <div>
            <p className="text-sm text-slate-600">{t("settings.access_temp_password_note")}</p>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 p-3 font-mono text-sm">
              <span className="flex-1 break-all">{secret}</span>
              <CopyPasswordButton value={secret} label={t("settings.access_copy_password")} />
            </div>
          </div>
        ) : revealAsk ? (
          /* Owner re-authentication — viewing an employee's password requires
             the owner's own login password, verified server-side. */
          <div>
            <div className="flex items-start gap-3.5 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-white px-4 py-4">
              <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rose-100 bg-white text-rose-500 shadow-sm">
                <KeyRound size={20} strokeWidth={2.1} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{t("settings.access_reveal_title")}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("settings.access_reveal_note", { name: revealAsk.row.employee_name })}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="owner-actor-password">
                {t("settings.access_reveal_prompt")}
              </label>
              <input
                id="owner-actor-password"
                name="dmr-owner-password-verification"
                type="password"
                autoComplete="new-password"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                readOnly={!revealInputReady}
                value={actorPassword}
                onChange={(event) => setActorPassword(event.target.value)}
                onFocus={() => setRevealInputReady(true)}
                onPointerDown={() => setRevealInputReady(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && actorPassword && !revealBusy) void revealPassword();
                }}
                autoFocus
                className={`${opsInputClass} w-full`}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={15} strokeWidth={2.4} /></span>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={!actorPassword || revealBusy}
                onClick={() => void revealPassword()}
                className="group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/25 transition-all duration-200 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/40 hover:before:translate-x-full active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
              >
                <span className="relative z-10 inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><Eye size={14} strokeWidth={2.4} /></span>
                <span className="relative z-10">{t("settings.access_reveal_confirm")}</span>
              </button>
            </div>
          </div>
        ) : dialog?.kind?.includes("history") ? (
          <div className="max-h-[55vh] overflow-auto">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {dialog.kind.startsWith("login")
                  ? t("settings.access_no_login_activity")
                  : t("settings.access_no_security_events")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr>
                      <th className="p-2">{t("settings.access_col_datetime")}</th>
                      <th className="p-2">{t("settings.access_col_event")}</th>
                      <th className="p-2">{t("settings.access_col_result")}</th>
                      <th className="p-2">{t("settings.access_col_details")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, index) => (
                      <tr key={String(entry.id ?? index)} className="border-t transition-colors hover:bg-slate-50/70">
                        <td className="p-2 whitespace-nowrap tabular-nums">{fmt(entry.created_at)}</td>
                        <td className="p-2">{eventBadge(entry.event)}</td>
                        <td className="p-2 font-medium">{String(entry.result ?? entry.performed_by ?? "—")}</td>
                        <td className="p-2">
                          {entry.ip ? (
                            <span className="text-slate-500">
                              <span className="font-semibold text-slate-600">IP:</span> {String(entry.ip)}
                              {entry.user_agent ? (
                                <span className="mt-0.5 block max-w-[320px] truncate text-[10px] text-slate-400" title={String(entry.user_agent)}>
                                  {String(entry.user_agent)}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="whitespace-pre-line text-slate-500">{formatDetails(entry.details)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Confirm body — icon chip + copy, then an animated Cancel / Confirm
                pair whose tone matches the action (amber pause, emerald resume,
                rose revoke, violet reset). Same rhythm as the grant dialog. */}
            {(() => {
              const tone = confirmTone[dialog?.kind ?? ""] ?? confirmTone.resume;
              const ToneIcon = tone.icon;
              return (
                <div className="flex items-start gap-3.5 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-white px-4 py-4">
                  <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm">
                    <ToneIcon size={22} strokeWidth={2.1} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {dialog?.row?.employee_name ?? ""}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {t("settings.access_confirm_note")}
                    </p>
                  </div>
                </div>
              );
            })()}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow-md active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
              >
                <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={15} strokeWidth={2.4} /></span>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void mutate(dialog?.kind ?? "", dialog?.row)}
                className={`group relative inline-flex min-h-10 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r px-5 py-2 text-xs font-bold text-white shadow-md transition-all duration-200 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-transform before:duration-500 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  confirmTone[dialog?.kind ?? ""]?.button ?? confirmTone.resume.button
                }`}
              >
                <span className="relative z-10">{t("common.confirm")}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
