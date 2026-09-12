// src/ui/Sidebar/navMotion.ts
// -----------------------------------------------------------------------------
// Sidebar hover motions: every navigation entry "acts out" its own name when
// the pointer lands on the row.
//
//   Trip Entry / Trip List / Driver Performance → the truck drives off and back
//   Rate Entry                                 → the rupee flips like a coin
//   Maintenance Entry                          → the wrench turns on the bolt
//   Permits & Documents / Shop Ledger          → the page turns over
//   …and so on, one motion per meaning.
//
// The keyframes live in src/styles/tokens.css (`--animate-nav-*` family), the
// single source of truth for motion. This file only maps a nav path to the
// utility class that triggers it.
//
// IMPORTANT — the class strings below are written out in FULL (variants
// included). Tailwind scans source text for utility candidates, so a class
// assembled at runtime (`animate-${name}`) would never be generated and the
// animation would silently do nothing. Add a motion here, not by concatenation.
// -----------------------------------------------------------------------------

/* -- one literal pair per motion (kept verbatim so Tailwind can see them) --- */
const DRIVE = "group-hover:animate-nav-drive group-focus-visible:animate-nav-drive";
const DRIVE_FAST = "group-hover:animate-nav-drive-fast group-focus-visible:animate-nav-drive-fast";
const COIN = "group-hover:animate-nav-coin group-focus-visible:animate-nav-coin";
const TIGHTEN = "group-hover:animate-nav-tighten group-focus-visible:animate-nav-tighten";
const PAGE = "group-hover:animate-nav-page group-focus-visible:animate-nav-page";
const SWING = "group-hover:animate-nav-swing group-focus-visible:animate-nav-swing";
const SWIPE = "group-hover:animate-nav-swipe group-focus-visible:animate-nav-swipe";
const FLIP = "group-hover:animate-nav-flip group-focus-visible:animate-nav-flip";
const CLOCK = "group-hover:animate-nav-clock group-focus-visible:animate-nav-clock";
const REWIND = "group-hover:animate-nav-rewind group-focus-visible:animate-nav-rewind";
const SEESAW = "group-hover:animate-nav-seesaw group-focus-visible:animate-nav-seesaw";
const PUMP = "group-hover:animate-nav-pump group-focus-visible:animate-nav-pump";
const FLAP = "group-hover:animate-nav-flap group-focus-visible:animate-nav-flap";
const RISE = "group-hover:animate-nav-rise group-focus-visible:animate-nav-rise";
const GROW = "group-hover:animate-nav-grow group-focus-visible:animate-nav-grow";
const BARS = "group-hover:animate-nav-bars group-focus-visible:animate-nav-bars";
const TILES = "group-hover:animate-nav-tiles group-focus-visible:animate-nav-tiles";
const CLIP = "group-hover:animate-nav-clip group-focus-visible:animate-nav-clip";
const PEOPLE = "group-hover:animate-nav-people group-focus-visible:animate-nav-people";
const PILLARS = "group-hover:animate-nav-pillars group-focus-visible:animate-nav-pillars";
const DOOR = "group-hover:animate-nav-door group-focus-visible:animate-nav-door";
const ROOF = "group-hover:animate-nav-roof group-focus-visible:animate-nav-roof";
const BOOK = "group-hover:animate-nav-book group-focus-visible:animate-nav-book";
const WALLET = "group-hover:animate-nav-wallet group-focus-visible:animate-nav-wallet";
const CALENDAR = "group-hover:animate-nav-calendar group-focus-visible:animate-nav-calendar";
const CHECK = "group-hover:animate-nav-check group-focus-visible:animate-nav-check";
const GEAR = "group-hover:animate-nav-gear group-focus-visible:animate-nav-gear";
const STACK = "group-hover:animate-nav-stack group-focus-visible:animate-nav-stack";
const NOTE = "group-hover:animate-nav-note group-focus-visible:animate-nav-note";

interface NavMotion {
  /** Full utility string — hover + keyboard-focus variants. */
  motion: string;
  /** Transform origin the motion reads best from (bars grow off the baseline). */
  origin?: "origin-bottom" | "origin-top" | "origin-left";
}

/** One motion per nav destination. */
const MOTION_BY_PATH: Record<string, NavMotion> = {
  // ── Overview ────────────────────────────────────────────────────────────
  "/dashboard": { motion: TILES },

  // ── Masters ─────────────────────────────────────────────────────────────
  "/masters?tab=shops": { motion: DOOR, origin: "origin-bottom" },
  "/masters?tab=farms": { motion: ROOF, origin: "origin-bottom" },
  "/masters?tab=vehicles": { motion: DRIVE_FAST },
  "/masters?tab=employees": { motion: PEOPLE },
  "/masters?tab=banks": { motion: PILLARS, origin: "origin-bottom" },
  "/masters?tab=birdTypes": { motion: FLAP },
  "/accounts?tab=market-rate": { motion: RISE },

  // ── Operations ──────────────────────────────────────────────────────────
  "/operations?tab=overview": { motion: CLIP },
  "/operations?tab=trip-entry": { motion: DRIVE },
  "/operations?tab=trip-list": { motion: DRIVE },
  "/operations?tab=rate-entry": { motion: COIN },
  "/operations?tab=shop-sales": { motion: SWING },
  "/operations?tab=collection": { motion: SWIPE },
  "/operations?tab=pending-collections": { motion: CLOCK },
  "/operations?tab=mortality": { motion: SEESAW },
  "/operations?tab=fuel-expenses": { motion: PUMP },
  "/operations?tab=orders": { motion: STACK },
  "/operations?tab=collection-report": { motion: FLIP },

  // ── Fleet ───────────────────────────────────────────────────────────────
  "/fleet?tab=entry": { motion: TIGHTEN },
  "/fleet?tab=history": { motion: REWIND },
  "/fleet?tab=permits": { motion: PAGE },
  "/fleet?tab=emi": { motion: NOTE },
  "/fleet?tab=fastag": { motion: SWING },
  "/fleet?tab=analytics": { motion: BARS, origin: "origin-bottom" },

  // ── Staff ───────────────────────────────────────────────────────────────
  "/staff?tab=duty-planner": { motion: CALENDAR },
  "/staff?tab=salary-sheet": { motion: WALLET },
  "/staff?tab=leaves": { motion: CALENDAR },
  "/staff?tab=driver-performance": { motion: DRIVE },
  "/staff?tab=supervisor-performance": { motion: CHECK },

  // ── Accounts ────────────────────────────────────────────────────────────
  "/accounts?tab=summary": { motion: BARS, origin: "origin-bottom" },
  "/accounts?tab=paid-payments": { motion: BOOK },
  "/accounts?tab=farm-payment": { motion: GROW, origin: "origin-bottom" },

  // ── Reports ─────────────────────────────────────────────────────────────
  "/reports?tab=shopLedger": { motion: PAGE },

  // ── Settings ────────────────────────────────────────────────────────────
  "/settings?tab=appearance": { motion: GEAR },
};

/** Fallback for entries without a bespoke motion: a gentle, shared lift. */
const DEFAULT_MOTION: NavMotion = { motion: PEOPLE };

/**
 * Classes for a nav row's icon. `group-hover:` + `group-focus-visible:` keep
 * the motion opt-in: the row is the group, so the glyph only moves while the
 * pointer or keyboard focus is on that row — an active (current page) row that
 * is not hovered stays still.
 */
export function navMotionClass(path: string): string {
  const { motion, origin } = MOTION_BY_PATH[path] ?? DEFAULT_MOTION;
  return origin ? `${origin} ${motion}` : motion;
}

/** True when this entry has a motion written specifically for it. */
export function hasBespokeNavMotion(path: string): boolean {
  return path in MOTION_BY_PATH;
}

/** Every motion currently registered (used by the docs/tests sanity check). */
export const NAV_MOTIONS: readonly string[] = Object.values(MOTION_BY_PATH).map((m) => m.motion);
