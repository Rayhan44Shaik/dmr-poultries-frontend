import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { onRequest } from "../../functions/api/[[path]].ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const env = { API_ORIGIN: "https://office-api.example", TRUSTED_PROXY_SECRET: "x".repeat(32) };

function stubFetch(response: Response | (() => Promise<Response>)) {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(input);
    seenInit = init;
    return typeof response === "function" ? response() : response;
  }) as typeof fetch;
  return () => ({ seenUrl, seenInit });
}

describe("Cloudflare Pages API proxy", () => {
  it("preserves method, query, body, Cookie, Authorization, status, and every Set-Cookie", async () => {
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append("set-cookie", "dmr_session=new; HttpOnly; Secure; SameSite=Strict; Path=/");
    upstreamHeaders.append("set-cookie", "dmr_mfa=challenge; HttpOnly; Secure; SameSite=Strict; Path=/");
    const seen = stubFetch(new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: upstreamHeaders,
    }));

    const request = new Request("https://erp.example/api/auth/login?next=1", {
      method: "POST",
      headers: {
        cookie: "dmr_session=old",
        authorization: "Bearer mobile-token",
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "attacker-value",
        "x-forwarded-host": "attacker.example",
        "x-real-ip": "203.0.113.9",
        forwarded: "for=203.0.113.9",
        "x-dmr-proxy-secret": "attacker-secret",
      },
      body: JSON.stringify({ username: "employee" }),
    });
    const response = await onRequest({ request, env });

    const { seenUrl, seenInit } = seen();
    assert.equal(seenUrl, "https://office-api.example/api/auth/login?next=1");
    assert.equal(seenInit?.method, "POST");
    const headers = new Headers(seenInit?.headers);
    assert.equal(headers.get("cookie"), "dmr_session=old");
    assert.equal(headers.get("authorization"), "Bearer mobile-token");
    assert.equal(headers.get("cf-connecting-ip"), "203.0.113.7");
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(headers.get("x-forwarded-host"), null);
    assert.equal(headers.get("x-real-ip"), null);
    assert.equal(headers.get("forwarded"), null);
    assert.equal(headers.get("x-dmr-proxy-secret"), env.TRUSTED_PROXY_SECRET);
    assert.equal(response.status, 201);
    assert.deepEqual(response.headers.getSetCookie(), [
      "dmr_session=new; HttpOnly; Secure; SameSite=Strict; Path=/",
      "dmr_mfa=challenge; HttpOnly; Secure; SameSite=Strict; Path=/",
    ]);
  });

  it("fails closed when proxy secrets or HTTPS origin are invalid", async () => {
    const request = new Request("https://erp.example/api/health");
    assert.equal((await onRequest({ request, env: { API_ORIGIN: "https://office.example", TRUSTED_PROXY_SECRET: "short" } })).status, 503);
    assert.equal((await onRequest({ request, env: { API_ORIGIN: "http://office.example", TRUSTED_PROXY_SECRET: "x".repeat(32) } })).status, 503);
    assert.equal((await onRequest({ request, env: { API_ORIGIN: "https://office.example/path", TRUSTED_PROXY_SECRET: "x".repeat(32) } })).status, 503);
  });

  it("rejects unsupported methods, non-API paths and oversized declared bodies", async () => {
    const unsupported = new Request("https://erp.example/api/auth/me", { method: "PROPFIND" });
    assert.equal((await onRequest({ request: unsupported, env })).status, 405);

    const outside = new Request("https://erp.example/internal/health");
    assert.equal((await onRequest({ request: outside, env })).status, 404);

    const large = new Request("https://erp.example/api/auth/login", {
      method: "POST",
      headers: { "content-length": String(26 * 1024 * 1024) },
      body: "x",
    });
    assert.equal((await onRequest({ request: large, env })).status, 413);
  });

  it("forwards every allowed HTTP method and never sends a GET/HEAD body", async () => {
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const seen = stubFetch(new Response(null, { status: 204 }));
      const request = new Request("https://erp.example/api/auth/me", {
        method,
        body: method === "GET" || method === "HEAD" ? undefined : "payload",
      });
      const response = await onRequest({ request, env });
      assert.equal(response.status, 204, method);
      assert.equal(seen().seenInit?.method, method);
      if (method === "GET" || method === "HEAD") {
        assert.equal(seen().seenInit?.body, undefined, `${method} must not carry a body`);
      }
    }
  });

  it("preserves backend failure statuses without leaking internals", async () => {
    for (const status of [401, 403, 404, 500]) {
      stubFetch(new Response(JSON.stringify({ error: "upstream" }), {
        status,
        headers: { "content-type": "application/json" },
      }));
      const response = await onRequest({
        request: new Request("https://erp.example/api/auth/me"),
        env,
      });
      assert.equal(response.status, status);
      assert.equal(await response.text(), JSON.stringify({ error: "upstream" }));
    }
  });

  it("returns 502 when the upstream is unreachable", async () => {
    stubFetch(() => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:4000")));
    const response = await onRequest({
      request: new Request("https://erp.example/api/health"),
      env,
    });
    assert.equal(response.status, 502);
    assert.equal(await response.text(), "Bad gateway");
  });
});
