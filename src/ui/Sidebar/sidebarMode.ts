// src/ui/Sidebar/sidebarMode.ts
// -----------------------------------------------------------------------------
// Desktop navigation width state. The sidebar is no longer a fixed 260px panel:
// it steps expanded → icon rail → hidden, and the header menu button brings it
// back. Shared by DashboardLayout (which owns the state and the content offset)
// and Sidebar (which renders the three shapes).
// -----------------------------------------------------------------------------

/** expanded = full labels · rail = icons only · hidden = no sidebar at all. */
export type SidebarMode = "expanded" | "rail" | "hidden";

export const SIDEBAR_STORAGE_KEY = "dmr-sidebar-mode";

export const SIDEBAR_WIDTH: Record<SidebarMode, number> = {
  expanded: 260,
  rail: 72,
  hidden: 0,
};

/** Content offset for each mode (only applies from the `lg` breakpoint up). */
export const SIDEBAR_CONTENT_CLASS: Record<SidebarMode, string> = {
  expanded: "lg:pl-[260px]",
  rail: "lg:pl-[72px]",
  hidden: "lg:pl-0",
};

/** Next mode in the cycle: expanded → rail → hidden → expanded. */
export function nextSidebarMode(mode: SidebarMode): SidebarMode {
  if (mode === "expanded") return "rail";
  if (mode === "rail") return "hidden";
  return "expanded";
}

export function isValidSidebarMode(value: unknown): value is SidebarMode {
  return value === "expanded" || value === "rail" || value === "hidden";
}
