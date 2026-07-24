import { Component, type ErrorInfo, type ReactNode } from 'react';

/** 컴포넌트 오류가 전체 화면을 무너뜨리지 않도록 방어 (특히 과도기 상태 분석). */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught', error, info.componentStack);
    // 다음 상태 갱신에서 회복 시도
    setTimeout(() => this.setState({ hasError: false }), 200);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="grid min-h-dvh place-items-center bg-felt text-hanji/70">
            화면을 복구하는 중…
          </div>
        )
      );
    }
    return this.props.children;
  }
}
