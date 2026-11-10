// PG-007 提出物（D-136）。まだ出していないもの と 出したもの（この一週間）の2列。取り消しはこの画面だけ
import { useEffect } from "react";
import { HomeBackButton } from "../../components/HomeBackButton";
import { COPY } from "../../copy";
import { useText } from "../../grade";
import { AssignmentRow, FrameBody } from "./parts";
import { notSubmitted, recentlySubmitted } from "./rules";
import { takeFocusRequest, useHomeData } from "./use-home-data";
import "./home.css";

export function AssignmentsPage({ onGoHome, showToast }: { onGoHome: () => void; showToast: (text: string) => void }) {
  const t = useText();
  const home = useHomeData(showToast, { timetable: false });
  const ready = home.assignments.status === "ready";
  // ファーストディスプレイで名前を押した時は、その行に focus を置く
  useEffect(() => {
    if (!ready) return;
    const id = takeFocusRequest();
    if (id) document.querySelector<HTMLElement>(`[data-assignment="${CSS.escape(id)}"] .home-row__title`)?.focus();
  }, [ready]);
  return (
    <div className="home home--sub">
      <header className="home__bar">
        <HomeBackButton onClick={onGoHome} />
        <h1 className="home__title">{t(COPY.CP_761)}</h1>
      </header>
      <main className="home__sub-body home__columns">
        <FrameBody load={home.assignments} onRetry={home.reload}>
          {(data) => {
            const todo = notSubmitted(data.assignments);
            const done = recentlySubmitted(data.assignments, data.now);
            return (
              <>
                <section className="home-frame" aria-labelledby="home-todo-title">
                  <div className="home-frame__head"><h2 id="home-todo-title">{t(COPY.CP_762)}</h2></div>
                  {todo.length === 0 ? <p className="home-frame__empty">{t(COPY.CP_764)}</p> : (
                    <ul className="home-rows home-rows--scroll">
                      {todo.map((a) => <AssignmentRow key={a.id} assignment={a} now={data.now} onSubmit={home.submit} />)}
                    </ul>
                  )}
                </section>
                <section className="home-frame" aria-labelledby="home-done-title">
                  <div className="home-frame__head"><h2 id="home-done-title">{t(COPY.CP_763)}</h2></div>
                  <ul className="home-rows home-rows--scroll">
                    {done.map((a) => <AssignmentRow key={a.id} assignment={a} now={data.now} onSubmit={home.submit} onWithdraw={home.withdraw} />)}
                  </ul>
                </section>
              </>
            );
          }}
        </FrameBody>
      </main>
      <p className="visually-hidden" role="status">{t(home.announce)}</p>
    </div>
  );
}
