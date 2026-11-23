# Supervisor Mobile Trip Entry — disabled in this release

Supervisor Mobile is **not part of the current production release**.

- The frontend `/mobile` and `/mobile/trips` routes redirect to `/operations`.
- The backend mounts no `/mobile` router and issues no mobile Bearer token.
- Desktop authentication is HttpOnly-cookie-only and must not be mixed with a
  mobile token flow.
- The module source remains for a future, separately approved release. It is
  not reachable from navigation and is not loaded by the route table.

Re-enabling it requires a complete design decision covering:

1. A dedicated `/api/mobile` backend router and Supervisor-only role checks.
2. A separate Bearer-token lifecycle (issue, refresh/expiry, revoke, logout).
3. Mobile-safe storage and transport, plus rate limiting.
4. Full login, MFA, session-expiry, revocation and cross-role-denial tests.
5. Cloudflare Pages proxy compatibility for the Bearer flow.

Do not expose `/api/mobile/*` or issue mobile tokens until those requirements
are implemented and verified.
