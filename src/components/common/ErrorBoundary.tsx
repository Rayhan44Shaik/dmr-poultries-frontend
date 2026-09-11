import React, { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import { translate } from '../../i18n';
import { guardedReload, isChunkLoadError } from '../../routes/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  /** A stale chunk/module-import failure is recovering via reload. */
  recovering: boolean;
  /** Chunk failure survived retries + the reload guard — show recovery UI. */
  chunkFailure: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, recovering: false, chunkFailure: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      recovering: false,
      chunkFailure: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    if (isChunkLoadError(error)) {
      // One guarded automatic reload. If the guard blocks it (a reload already
      // happened within the window), render the manual recovery screen.
      const reloading = guardedReload();
      if (reloading) this.setState({ recovering: true });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Stale chunk / dynamic-import failure that survived auto-recovery.
    if (this.state.chunkFailure && !this.state.recovering) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <RefreshCw size={26} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
              The app was updated while this tab was open
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              This page is referencing an old version of the application modules. A refresh
              will load the latest version — your data is unaffected.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <RefreshCw size={16} />
              Reload application
            </button>
            <p className="mt-3 text-xs text-slate-400">
              If it keeps happening, close this tab and open the latest preview link again.
            </p>
          </div>
        </div>
      );
    }

    if (this.state.recovering) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">Updating to the latest version…</h2>
          <p className="text-sm text-slate-500">Loading the fresh application modules.</p>
        </div>
      );
    }

    return (
      this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800">{translate('error.something_wrong')}</h2>
          <p className="text-gray-600 mt-2">
            {this.state.error?.message || translate('error.unexpected')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {translate('error.try_again')}
          </button>
        </div>
      )
    );
  }
}
