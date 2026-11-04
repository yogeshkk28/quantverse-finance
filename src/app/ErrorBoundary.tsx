import React from "react";

interface State {
  error: Error | null;
}

/** Shows a recoverable message instead of a blank page when a view crashes. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Lumina] View crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-lq-bg text-lq-text flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="lq-h2">Something went wrong on this page.</h1>
          <p className="text-sm text-lq-muted">{this.state.error.message}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="lq-btn"
            >
              Reload
            </button>
            <a href="/" className="lq-btn lq-btn--ghost">
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
