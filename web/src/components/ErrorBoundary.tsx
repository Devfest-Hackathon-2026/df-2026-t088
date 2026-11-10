import { Component, Fragment, useEffect, useRef } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { COPY } from "../copy";
import { GradeProvider } from "../grade";
import { Button } from "./Button";
import { Ruby } from "./Ruby";
import "./ErrorBoundary.css";

interface ErrorBoundaryState {
  hasError: boolean;
  /** 描き直すたびに増やし、中身を新しく作り直す */
  attempt: number;
}

/**
 * CMP-019 立て直しの画面（D-108）。描画のエラーで画面が真っ白にならないよう、全体を包む。
 * エラーの中身は画面に出さず、コンソールに残す。保存した進みには触らない
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("画面の描画でエラーが出たため、立て直しの画面を出しました", error, info.componentStack);
  }

  private readonly restart = () => {
    this.setState((old) => ({ hasError: false, attempt: old.attempt + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) return <RecoveryScreen onRestart={this.restart} />;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

function RecoveryScreen({ onRestart }: { onRestart: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  // アプリの中の GradeProvider ごと壊れていることがあるので、ここでも学年を読み直す
  return (
    <GradeProvider>
      <main className="recovery">
        <section className="recovery__paper" role="alert">
          <h1 className="recovery__title" ref={headingRef} tabIndex={-1}><Ruby text={COPY.CP_921} /></h1>
          <p><Ruby text={COPY.CP_922} /></p>
          <Button variant="primary" se="enter" onClick={onRestart}><Ruby text={COPY.CP_923} /></Button>
        </section>
      </main>
    </GradeProvider>
  );
}
