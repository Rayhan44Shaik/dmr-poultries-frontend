import React, { Component } from 'react';
import { Home, RefreshCw, ShieldCheck, Unplug, Wrench } from 'lucide-react';
import { translate } from '../../i18n';
import {
  ChunkLoadError,
  diagnoseConnection,
  forceReload,
  isChunkLoadError,
} from '../../routes/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  /** "spinner" state while an automatic reload is imminent. */
  reloading: boolean;
  /** Server/tunnel cannot be reached — auto-reconnect in progress. */
  reconnecting: boolean;
  /** Seconds left until the stale-tab screen reloads itself (null = idle). */
  staleCountdown: number | null;
}

const ENTRY_PROBE = '/src/main.tsx';
/** How long the stale-version screen waits before reloading by itself. */
const STALE_AUTO_RELOAD_SECONDS = 6;

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private staleTimer: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, reloading: false, reconnecting: false, staleCountdown: null };
  }

  componentWillUnmount(): void {
    if (this.reconnectTimer !== null) window.clearInterval(this.reconnectTimer);
    if (this.staleTimer !== null) window.clearInterval(this.staleTimer);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    if (isChunkLoadError(error)) {
      void this.recoverFromChunkError(error);
      if (error instanceof ChunkLoadError && error.kind === 'stale') {
        this.startStaleCountdown();
      }
    }
  }

  /** A stale tab heals itself: count down and reload, so the user never has
   *  to notice or click anything (a "Reload now" button is still offered). */
  private startStaleCountdown(): void {
    if (this.staleTimer !== null) return;
    this.setState({ staleCountdown: STALE_AUTO_RELOAD_SECONDS });
    this.staleTimer = window.setInterval(() => {
      this.setState((prev) => {
        if (prev.staleCountdown === null) return prev;
        if (prev.staleCountdown <= 1) {
          if (this.staleTimer !== null) {
            window.clearInterval(this.staleTimer);
            this.staleTimer = null;
          }
          forceReload();
          return prev;
        }
        return { ...prev, staleCountdown: prev.staleCountdown - 1 };
      });
    }, 1000);
  }

  /** Chunk failures: diagnose (waiting out cold tunnels), then either
   *  auto-reload, auto-reconnect, or show the broken-module screen. */
  private async recoverFromChunkError(error: Error): Promise<void> {
    const chunkError = error instanceof ChunkLoadError ? error : null;

    // lazyWithRetry has already diagnosed; trust its verdicts.
    if (chunkError) {
      if (chunkError.kind === 'unreachable') this.startReconnect();
      // 'broken' / 'stale' stay on their manual recovery cards.
      return;
    }

    try {
      const verdict = await diagnoseConnection(error);
      if (verdict === 'reload') {
        this.setState({ reloading: true });
        window.setTimeout(() => forceReload(), 350);
      } else if (verdict === 'unreachable') {
        this.startReconnect();
      }
    } catch (diagnosed) {
      if (diagnosed instanceof ChunkLoadError && diagnosed.kind === 'broken') {
        this.setState({ error: diagnosed });
      }
    }
  }

  private startReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.setState({ reconnecting: true });
    this.reconnectAttempts = 0;
    this.reconnectTimer = window.setInterval(async () => {
      this.reconnectAttempts += 1;
      try {
        const res = await fetch(ENTRY_PROBE, { cache: 'no-store' });
        if (res.ok) {
          if (this.reconnectTimer !== null) window.clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
          forceReload();
        }
      } catch {
        // still down — keep polling indefinitely; the UI offers manual actions
      }
      // After ~2 minutes, stop the spinner wording and let the user drive.
      if (this.reconnectAttempts > 48 && this.reconnectTimer !== null) {
        window.clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
        this.setState({ reconnecting: false });
      }
    }, 2500);
  }

  private shell(inner: React.ReactNode): React.ReactNode {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card-lg">
          {inner}
        </div>
      </div>
    );
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    const error = this.state.error;
    const chunk = error instanceof ChunkLoadError ? error : null;

    if (this.state.reloading) {
      return this.shell(
        <>
          <RefreshCw className="mx-auto mb-4 h-9 w-9 animate-spin text-emerald-600" />
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            Updating to the latest version…
          </h2>
          <p className="mt-2 text-sm text-slate-500">Loading the fresh application modules.</p>
        </>
      );
    }

    const unreachable = this.state.reconnecting || chunk?.kind === 'unreachable';
    if (unreachable) {
      return this.shell(
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
            <Unplug size={26} />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            Reconnecting to the preview…
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            The live preview server is starting up or this tab points at an older preview link. We
            are retrying automatically — this page will reload itself the moment it is back.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {this.state.reconnecting ? 'Waiting for the server…' : 'Reconnecting…'}
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => forceReload()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <RefreshCw size={16} />
              Reload now
            </button>
            <a
              href="/"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Home size={16} />
              Go to home
            </a>
          </div>
        </>
      );
    }

    if (chunk?.kind === 'broken') {
      return this.shell(
        <>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <Wrench size={26} />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
            This page failed to build
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            The server answered but the module <code className="rounded bg-slate-100 px-1 text-xs">{chunk.url.split('/').pop()}</code>{' '}
            returned an error{chunk.status ? ` (HTTP ${chunk.status})` : ''}. Refreshing will not fix a
            code/build error — check the dev server logs.
          </p>
          {chunk.detail && (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-left text-[11px] leading-relaxed text-rose-200">
              {chunk.detail}
            </pre>
          )}
          <button
            type="button"
            onClick={() => forceReload()}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            <RefreshCw size={16} />
            Reload anyway
          </button>
        </>
      );
    }

    if (isChunkLoadError(error)) {
      const countdown = this.state.staleCountdown;
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_46%_at_50%_38%,rgba(16,185,129,0.09),transparent_72%)]" />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card-lg">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <RefreshCw className="h-7 w-7 animate-spin" style={{ animationDuration: '2.4s' }} />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
              The app was updated while this tab was open
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
              This page is still running an older version of the app. Reloading loads the latest one
              instantly — your data and work are completely safe.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <ShieldCheck size={14} />
              Your data is safe — nothing is lost
            </div>
            {countdown !== null && (
              <div className="mt-6">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / STALE_AUTO_RELOAD_SECONDS) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-slate-400">
                  Reloading automatically in {countdown}s…
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => forceReload()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <RefreshCw size={16} />
              Reload now
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
              If this keeps happening, close this tab and open the latest preview link again.
            </p>
          </div>
        </div>
      );
    }

    return (
      this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800">{translate('error.something_wrong')}</h2>
          <p className="mt-2 text-gray-600">{this.state.error?.message || translate('error.unexpected')}</p>
          <button
            onClick={() => forceReload()}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {translate('error.try_again')}
          </button>
        </div>
      )
    );
  }
}
