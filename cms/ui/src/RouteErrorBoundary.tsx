import { Component, type ErrorInfo, type ReactNode } from "react";

interface RouteErrorBoundaryProps {
  resetKey: string;
  onBack: () => void;
  onRetry: () => void;
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error?: Error;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {};

  static getDerivedStateFromError(cause: unknown): RouteErrorBoundaryState {
    return {
      error: cause instanceof Error ? cause : new Error("記事を取得できませんでした"),
    };
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Failed to render CMS route", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="panel" aria-labelledby="route-error-heading">
        <h2 id="route-error-heading">記事を表示できませんでした</h2>
        <p className="error-message" role="alert">{this.state.error.message}</p>
        <div className="form-actions">
          <button className="primary" type="button" onClick={this.props.onRetry}>
            再試行
          </button>
          <button type="button" onClick={this.props.onBack}>
            記事一覧へ戻る
          </button>
        </div>
      </section>
    );
  }
}
