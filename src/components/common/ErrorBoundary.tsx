import React, { Component } from 'react';
import { translate } from '../../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  /** A stale chunk/module-import failure is recovering via reload. */
  recovering: boolean;
}

const RELOAD_KEY = 'dmr:error-boundary-reload-at';

/** True when the app just needs a refresh to fetch the new module graph
 *  (dev-server restart, sandbox preview replacement or fresh deploy). */
function isStaleChunkError(error?: Error): boolean {
  const text = String(error?.message ?? '').toLowerCase();
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('error loading dynamically imported module') ||
    text.includes('importing a module script failed')
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, recovering: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    if (isStaleChunkError(error)) {
      let shouldReload = true;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        // Guard against a reload loop when a module is genuinely missing.
        if (Date.now() - last < 10_000) {
          shouldReload = false;
        } else {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        }
      } catch {
        /* sessionStorage unavailable */
      }
      if (shouldReload) {
        return { hasError: true, error, recovering: true };
      }
    }
    return { hasError: true, error, recovering: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    if (this.state.recovering) {
      // Give the user a beat to see the "updating" state, then reload.
      window.setTimeout(() => window.location.reload(), 600);
    }
  }

  render() {
    if (this.state.hasError) {
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

    return this.props.children;
  }
}
