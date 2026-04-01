"use client";

import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "monospace", color: "#fff", background: "#111" }}>
          <h1 style={{ color: "#f55" }}>React Error</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#faa" }}>
            {this.state.error?.message}
          </pre>
          <h2 style={{ color: "#fa5", marginTop: 20 }}>Stack</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#ddd", fontSize: 12 }}>
            {this.state.error?.stack}
          </pre>
          <h2 style={{ color: "#fa5", marginTop: 20 }}>Component Stack</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#adf", fontSize: 12 }}>
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
