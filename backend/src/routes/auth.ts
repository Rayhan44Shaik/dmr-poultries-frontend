import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import type { Request, Response, NextFunction } from "express";

// ── Desktop sign-in roles ───────────────────────────────────────────────────
// Two roles authenticate here:
//   • owner      → OWNER      — full access to every page and action.
//   • supervisor → SUPERVISOR — field-entry role. The frontend hides
//                  approve/delete affordances and blocks every other section;
//                  `requireRole` keeps the API honest for the writes too.
// Sessions are in-memory bearer tokens (swap for DB-backed sessions or JWTs
// when user administration lands — the contract below will not change).

export type AppRole = "OWNER" | "SENIOR_ACCOUNT" | "SUPERVISOR";

interface Account {
  id: number;
  username: string;
  displayName: string;
  role: AppRole;
  employeeId: number | null;
  password: string;
}

const ACCOUNTS: readonly Account[] = [
  { id: 1, username: "owner", displayName: "DMR Owner", role: "OWNER", employeeId: null, password: "owner123" },
  {
    id: 2,
    username: "supervisor",
    displayName: "Field Supervisor",
    role: "SUPERVISOR",
    employeeId: null,
    password: "supervisor123",
  },
];

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // a working day

interface Session {
  username: string;
  expiresAt: number;
}
const sessions = new Map<string, Session>();

// Node 22 has webcrypto on the global object; keep the dependency footprint nil.
function newToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenFromRequest(req: Request): string | null {
  const header = String(req.headers.authorization ?? "");
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function accountForRequest(req: Request): Account | null {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return ACCOUNTS.find((a) => a.username === session.username) ?? null;
}

/** 401 guard for everything that must be signed in. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const account = accountForRequest(req);
  if (!account) {
    res.status(401).json({ error: "unauthenticated", message: "Sign in to continue." });
    return;
  }
  (req as Request & { account?: Account }).account = account;
  next();
}

/** 403 guard: `requireRole("OWNER")` or `requireRole("OWNER","SUPERVISOR")`. */
export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const account = (req as Request & { account?: Account }).account;
    if (!account || !roles.includes(account.role)) {
      res.status(403).json({ error: "forbidden", message: "Your role cannot perform this action." });
      return;
    }
    next();
  };
}

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String((req.body as { username?: string } | undefined)?.username ?? "").trim().toLowerCase();
    const password = String((req.body as { password?: string } | undefined)?.password ?? "");
    const account = ACCOUNTS.find((a) => a.username === username && a.password === password);
    if (!account) {
      res.status(401).json({ error: "invalid_credentials", message: "Incorrect username or password." });
      return;
    }
    const token = newToken();
    sessions.set(token, { username: account.username, expiresAt: Date.now() + SESSION_TTL_MS });
    const { password: _password, ...user } = account;
    res.json({ user, token, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  })
);

authRouter.get("/me", requireAuth, (req, res) => {
  const account = (req as Request & { account?: Account }).account!;
  const token = tokenFromRequest(req)!;
  const session = sessions.get(token)!;
  const { password: _password, ...user } = account;
  res.json({ user, expiresAt: new Date(session.expiresAt).toISOString() });
});

authRouter.post("/logout", (req, res) => {
  const token = tokenFromRequest(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});
