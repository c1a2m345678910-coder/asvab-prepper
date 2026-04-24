'use client';

import React from 'react';
import Link from 'next/link';

interface Props {
  children: React.ReactNode;
  fallbackHref?: string;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  override render() {
    const { fallbackHref = '/', fallbackLabel = 'Go home' } = this.props;

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-950 text-white">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            {this.state.message && (
              <p className="text-sm text-slate-400 font-mono bg-slate-900 rounded-lg px-4 py-3 text-left break-words">
                {this.state.message}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Try again
              </button>
              <Link
                href={fallbackHref}
                className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm text-center active:scale-[0.98] transition-transform"
              >
                {fallbackLabel}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
