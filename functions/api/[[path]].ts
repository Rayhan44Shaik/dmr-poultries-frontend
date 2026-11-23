interface PagesEnv {
  API_ORIGIN: string;
  TRUSTED_PROXY_SECRET: string;
}

interface PagesContext {
  request: Request;
  env: PagesEnv;
}

const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
// Match the backend's express.json limit so existing bulk imports keep working.
const MAX_CONTENT_LENGTH = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 25_000;

function requiredOrigin(raw: string): URL {
  const value = raw.trim();
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.origin !== value) {
    throw new Error("API_ORIGIN must be an HTTPS origin without a path.");
  }
  return parsed;
}

/**
 * Copy upstream headers without letting the runtime merge multiple
 * Set-Cookie headers into one comma-joined value.
 */
function copyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers(upstream.headers);
  headers.delete("set-cookie");
  const withGetSetCookie = upstream.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof withGetSetCookie.getSetCookie === "function"
      ? withGetSetCookie.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) headers.append("set-cookie", cookie);
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) headers.append("set-cookie", single);
  }
  return headers;
}

/** Same-origin Cloudflare Pages proxy. Cookies, Authorization, method, query,
 * body, status, Set-Cookie, and response headers are preserved. The private
 * proof header lets the backend trust CF-Connecting-IP without trusting an
 * arbitrary public X-Forwarded-For value. The upstream origin is fixed by
 * deployment configuration; a request can never choose it. */
export async function onRequest(context: PagesContext): Promise<Response> {
  const secret = context.env.TRUSTED_PROXY_SECRET?.trim();
  if (!secret || secret.length < 32) return new Response("Proxy is not configured", { status: 503 });

  let upstreamOrigin: URL;
  try {
    upstreamOrigin = requiredOrigin(context.env.API_ORIGIN ?? "");
  } catch {
    return new Response("Proxy is not configured", { status: 503 });
  }

  if (!ALLOWED_METHODS.has(context.request.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { allow: [...ALLOWED_METHODS].join(", ") },
    });
  }

  const incoming = new URL(context.request.url);
  if (incoming.pathname !== "/api" && !incoming.pathname.startsWith("/api/")) {
    return new Response("Not found", { status: 404 });
  }

  const declaredLength = Number(context.request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTENT_LENGTH) {
    return new Response("Request body too large", { status: 413 });
  }

  const target = new URL(`${incoming.pathname}${incoming.search}`, upstreamOrigin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  // Never trust a browser-supplied forwarding chain. Cloudflare supplies the
  // real client address, and the private proof below authorizes it.
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-real-ip");
  headers.delete("forwarded");
  // Hop-by-hop headers and a stale content-length must not be forwarded; the
  // runtime recomputes framing for the streamed body.
  for (const name of [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-length",
  ]) {
    headers.delete(name);
  }
  headers.delete("x-dmr-proxy-secret");
  headers.set("x-dmr-proxy-secret", secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: context.request.method,
      headers,
      body:
        context.request.method === "GET" || context.request.method === "HEAD"
          ? undefined
          : context.request.body,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return controller.signal.aborted
      ? new Response("Gateway timeout", { status: 504 })
      : new Response("Bad gateway", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: copyResponseHeaders(upstream),
  });
}
