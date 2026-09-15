// InstanceWatchdog — dev-mode "stale tab" detector.
//
// The Vite dev server stamps every transformed module with its own instance
// id (see the `dmr-instance-stamp` plugin in vite.config.ts) and serves the
// live id at /__dmr/ping. When the dev server restarts, a tab that has not
// reloaded keeps executing the *previous* instance's JS/CSS while its data
// calls transparently reach the new server — charts and layouts from the
// current build silently go missing. This component polls /__dmr/ping (and
// re-checks immediately when the tab is focused/shown); the moment the
// serving instance no longer matches this tab's own stamp, it shows the
// "app was updated" screen and reloads itself, so the user never has to
// notice or click anything.
//
// In a production build /__dmr/ping does not exist and import.meta.env.DEV
// is false, so this component is a complete no-op.

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { forceReload } from '../../routes/lazyWithRetry';
import { INSTANCE_ID } from 'virtual:dmr-instance';

const PING_URL = '/__dmr/ping';
const POLL_MS = 15_000;
const RELOAD_SECONDS = 3;

const INSTANCE_STORAGE_KEY = 'dmr:instance';

export default function InstanceWatchdog() {
  const myId = INSTANCE_ID;
  const [stale, setStale] = useState(false);
  const [countdown, setCountdown] = useState(RELOAD_SECONDS);

  // Record which server instance this running tab belongs to. The inline
  // script injected into index.html (see vite.config.ts) compares the next
  // reload's HTML stamp against this value and forces one clean reload when
  // they differ — so a reload can never mix a new document with old code.
  useEffect(() => {
    if (!import.meta.env.DEV || !myId) return;
    try {
      sessionStorage.setItem(INSTANCE_STORAGE_KEY, myId);
    } catch {
      // storage unavailable — the poll-based detection below still covers us
    }
  }, [myId]);

  // Detect: poll the live instance id, re-check on focus/visibility.
  useEffect(() => {
    if (!import.meta.env.DEV || !myId) return;
    let stopped = false;

    const check = async () => {
      if (stopped || stale) return;
      try {
        const res = await fetch(PING_URL, { cache: 'no-store' });
        if (!res.ok) return; // server mid-restart — the next tick retries
        const data = (await res.json()) as { instance?: string };
        if (data.instance && data.instance !== myId) {
          setCountdown(RELOAD_SECONDS);
          setStale(true);
        }
      } catch {
        // unreachable — keep waiting; the interval keeps polling
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const interval = window.setInterval(() => void check(), POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    void check();

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [myId, stale]);

  // Heal: count down (started at RELOAD_SECONDS when staleness was detected)
  // and force a full reload at zero.
  useEffect(() => {
    if (!stale) return;
    const timer = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(timer);
          forceReload();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stale]);

  if (!stale) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-50 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_38%,rgba(16,185,129,0.09),transparent_72%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card-lg">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
          <RefreshCw className="h-7 w-7 animate-spin" style={{ animationDuration: '2.4s' }} />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
          The app was updated while this tab was open
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
          The preview server just restarted, so this tab is still running the older version of the
          app. Reloading loads the latest one instantly — your data and work are completely safe.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <ShieldCheck size={14} />
          Your data is safe — nothing is lost
        </div>
        <div className="mt-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / RELOAD_SECONDS) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            Reloading automatically in {countdown}s…
          </p>
        </div>
        <button
          type="button"
          onClick={() => forceReload()}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <RefreshCw size={16} />
          Reload now
        </button>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ExternalLink size={16} />
          Open in a fresh tab
        </a>
      </div>
    </div>
  );
}
