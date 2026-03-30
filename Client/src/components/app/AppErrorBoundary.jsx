import React from "react";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
            Recoverable app error
          </div>
          <h1 className="mt-5 text-3xl font-bold">Something broke, but the workspace is still recoverable.</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Reload the app to recover the session. If this keeps happening, inspect the browser console and backend logs with the request id.
          </p>
          {this.state.error?.message ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-200">
              {this.state.error.message}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-black"
            >
              Reload app
            </button>
            <a
              href="/"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white"
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
