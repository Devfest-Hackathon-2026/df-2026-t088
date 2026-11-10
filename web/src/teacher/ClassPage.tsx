import { useRef, useState, type KeyboardEvent } from "react";
import type { SubjectId } from "../data/types";
import { CLASS_COPY } from "./copy";
import { TeacherNav } from "./TeacherNav";
import { StumblesPanel, type Period } from "./StumblesPanel";
import { classSubjects, parseSubject, subjectName, subjectQuery } from "./progress-model";
import { ProgressPanel } from "./ProgressPanel";
import { LoopAssistantCard } from "./LoopAssistantCard";
import { LearningLoopDiagram } from "./LearningLoopDiagram";
import "./ClassPage.css";

export type ClassTab = "stumbles" | "progress" | "loop";
const TABS: ClassTab[] = ["stumbles", "progress", "loop"];
const TAB_LABEL: Record<ClassTab, string> = { stumbles: CLASS_COPY.tabStumbles, progress: CLASS_COPY.tabProgress, loop: CLASS_COPY.tabLoop };

// URL を今のタブ・期間・教科に合わせる（詰まっている問題・直近7日・算数は省略）
function syncUrl(tab: ClassTab, period: Period, subject: SubjectId) {
  const params = new URLSearchParams();
  if (tab !== "stumbles") params.set("tab", tab);
  if (tab === "stumbles" && period === "today") params.set("period", "today");
  if (tab === "progress" && subjectQuery(subject)) params.set("subject", subject);
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

// 学級のようす（SCR-T10）。「詰まっている問題」「子どもの進み」「学びの輪」をタブで替える。1275×665 に収めるため、学びの輪の図とアシスタントはタブの中に置く（D-126）。開いた時だけ読み、自動では読み直さない。
// 見出し・時刻・「新しくする」の行は出さない（D-184）。見出しは読み上げのためだけに残す
export function ClassPage({ initialTab = "stumbles", initialPeriod = "7days", initialSubject = "sansu" }: { initialTab?: ClassTab; initialPeriod?: Period; initialSubject?: SubjectId }) {
  const [tab, setTab] = useState<ClassTab>(initialTab);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  // 右のカードで承認などをしたら、左の輪も読み直す（#573）
  const [loopReloadKey, setLoopReloadKey] = useState(0);
  const subjects = classSubjects();
  const [subject, setSubject] = useState<SubjectId>(parseSubject(initialSubject));
  const tabRefs = useRef<Record<ClassTab, HTMLButtonElement | null>>({ stumbles: null, progress: null, loop: null });

  const choose = (next: ClassTab) => {
    setTab(next);
    syncUrl(next, period, subject);
  };
  const choosePeriod = (next: Period) => {
    setPeriod(next);
    syncUrl(tab, next, subject);
  };
  const chooseSubject = (next: SubjectId) => {
    setSubject(next);
    syncUrl(tab, period, next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] as ClassTab;
    choose(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <main className="class-page">
      <TeacherNav current="class" />
      <h1 className="class-page__title">{CLASS_COPY.title}</h1>
      <div className="class-page__tabbar">
        <div role="tablist" className="class-page__tabs">
          {TABS.map((id) => (
            <button
              key={id}
              ref={(el) => { tabRefs.current[id] = el; }}
              type="button"
              role="tab"
              id={`class-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="class-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              className="class-page__tab"
              onClick={() => choose(id)}
              onKeyDown={onKeyDown}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
        {tab === "stumbles" && (
          <div className="class-page__period">
            <label htmlFor="class-period">{CLASS_COPY.periodLabel}</label>
            <select id="class-period" value={period} onChange={(event) => choosePeriod(event.target.value as Period)}>
              <option value="7days">{CLASS_COPY.period7days}</option>
              <option value="today">{CLASS_COPY.periodToday}</option>
            </select>
          </div>
        )}
        {tab === "progress" && subjects.length > 1 && (
          <div className="class-page__period">
            <label htmlFor="class-subject">{CLASS_COPY.subjectLabel}</label>
            <select id="class-subject" value={subject} onChange={(event) => chooseSubject(parseSubject(event.target.value))}>
              {subjects.map((id) => (
                <option key={id} value={id}>{subjectName(id)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div role="tabpanel" id="class-tabpanel" aria-labelledby={`class-tab-${tab}`} className="class-page__panel">
        {tab === "stumbles" ? (
          <StumblesPanel period={period} reloadKey={0} />
        ) : tab === "progress" ? (
          <ProgressPanel reloadKey={0} subjectId={subject} />
        ) : (
          <div className="class-page__loop">
            <LearningLoopDiagram reloadKey={loopReloadKey} />
            <LoopAssistantCard onChanged={() => setLoopReloadKey((key) => key + 1)} />
          </div>
        )}
      </div>
    </main>
  );
}
