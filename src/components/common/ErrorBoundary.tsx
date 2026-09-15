import React, { Component } from 'react';
import { Home, RefreshCw, Unplug, Wrench } from 'lucide-react';
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
}

const ENTRY_PROBE = '/src/main.tsx';
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, reloading: false, reconnecting: false };
  }

  componentWillUnmount(): void {
    if (this.reconnectTimer !== null) window.clearInterval(this.reconnectTimer);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    if (isChunkLoadError(error)) {
      void this.recoverFromChunkError(error);
    }
  }

  /** Chunk failures: diagnose (waiting out cold tunnels), then either
   *  auto-reload, auto-reconnect, or show the broken-module screen. */
  private async recoverFromChunkError(error: Error): Promise<void> {
    const chunkError = error instanceof ChunkLoadError ? error : null;

    // lazyWithRetry has already diagnosed; trust its verdicts. A stale module
    // is a normal Vite refresh event, not a user-facing error: reload quietly
    // instead of blocking the dashboard with a stale-tab modal.
    if (chunkError) {
      if (chunkError.kind === 'unreachable') {
        this.startReconnect();
      } else if (chunkError.kind === 'stale') {
        this.setState({ reloading: true });
        window.setTimeout(() => forceReload(), 50);
      }
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
      return this.shell(
        <>
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Loading the dashboard…</h2>
          <p className="mt-2 text-sm text-slate-500">Applying the latest preview modules.</p>
        </>
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
