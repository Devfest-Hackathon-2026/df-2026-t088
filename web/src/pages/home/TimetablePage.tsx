// PG-008 時間割（D-136）。左に今日（無ければ次の授業の日）のコマ、右に1週間の表
import { HomeBackButton } from "../../components/HomeBackButton";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import { useText } from "../../grade";
import { FrameBody, SubjectTag, TimetableTable, weekdayName } from "./parts";
import { focusDay } from "./rules";
import { useHomeData } from "./use-home-data";
import "./home.css";

export function TimetablePage({ onGoHome, showToast }: { onGoHome: () => void; showToast: (text: string) => void }) {
  const t = useText();
  const home = useHomeData(showToast, { assignments: false });
  return (
    <div className="home home--sub">
      <header className="home__bar">
        <HomeBackButton onClick={onGoHome} />
        <h1 className="home__title">{t(COPY.CP_770)}</h1>
      </header>
      <main className="home__sub-body home__timetable">
        <FrameBody load={home.timetable} onRetry={home.reload}>
          {(data) => {
            const focus = focusDay(data.days, data.now);
            const day = data.days.find((d) => d.weekday === focus?.weekday);
            const name = weekdayName(focus?.weekday ?? 1);
            return (
              <>
                <section className="home-frame home-day" aria-labelledby="home-day-title">
                  <div className="home-frame__head"><h2 id="home-day-title"><Ruby text={focus?.isToday ? COPY.CP_771(name) : COPY.CP_772(name)} /></h2></div>
                  <ol className="home-day__list">
                    {day?.periods.map((p) => (
                      <li key={p.period}><span className="home-day__period">{p.period}</span><SubjectTag id={p.subjectId} /></li>
                    ))}
                  </ol>
                </section>
                <section className="home-frame home-week home-week--large" aria-label={t(COPY.CP_770)}>
                  <TimetableTable days={data.days} now={data.now} caption={COPY.CP_770} />
                </section>
              </>
            );
          }}
        </FrameBody>
      </main>
    </div>
  );
}
