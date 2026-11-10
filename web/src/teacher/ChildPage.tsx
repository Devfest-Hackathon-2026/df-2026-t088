// 一人の子の進み（SCR-T04）。章の札（CMP-037）と、選んだ章の本線のマスの一覧。点数・順位・「分かんない」は出さない
import { useMemo, useState } from "react";
import type { SubjectId } from "../data/types";
import { plainText } from "../ruby-text";
import { ProgressCell } from "./ProgressCell";
import { TeacherNav } from "./TeacherNav";
import { nameOf } from "./ProgressPanel";
import { ADMIN_COPY, CLASS_COPY, PROBLEM_COPY, TODAY_COPY } from "./copy";
import { childProgressOf, formatStudiedOn, sampleChapters, subjectQuery, type ChildProgress } from "./progress-model";
import { useClassProgress } from "./use-class-progress";
import "./ChildPage.css";

/** 章の中で最初の、終えていないマスの位置。全部終えていれば -1 */
function nextIndex(chapter: ChildProgress["chapters"][number]): number {
  for (let index = 0; index < chapter.total; index += 1) if (!chapter.doneSquares.includes(index)) return index;
  return -1;
}

export function ChildPage({ number, subjectId = "sansu" }: { number: string; subjectId?: SubjectId }) {
  // 保存した進み（API）から、この子の分を取る
  const state = useClassProgress(0, subjectId);
  const chapters = useMemo(() => sampleChapters(subjectId), [subjectId]);
  const child = useMemo(() => (state.status === "ready" ? childProgressOf(state.progress, number) : undefined), [state, number]);
  const name = nameOf(number);
  const firstWithNext = child ? child.chapters.findIndex((chapter) => nextIndex(chapter) >= 0) : -1;
  const [picked, setPicked] = useState<string | null>(null);

  const back = <a className="child-page__back" href={subjectQuery(subjectId) ? `?tab=progress&${subjectQuery(subjectId)}` : "?tab=progress"}>{PROBLEM_COPY.back}</a>;
  if (state.status === "loading") {
    return (
      <main className="child-page">
        <TeacherNav current="class" />
        <p>{back}</p>
        <p role="status">{TODAY_COPY.loading}</p>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="child-page">
        <TeacherNav current="class" />
        <p>{back}</p>
        <p role="alert">{state.code === "UNAUTHORIZED" ? ADMIN_COPY.notAuthorized : TODAY_COPY.connError}</p>
      </main>
    );
  }
  if (!child) {
    return (
      <main className="child-page">
        <TeacherNav current="class" />
        <p>{back}</p>
        <p role="status">{CLASS_COPY.notInClass}</p>
      </main>
    );
  }

  const selectedId = picked ?? child.chapters[Math.max(firstWithNext, 0)]?.chapterId;
  const selectedIndex = Math.max(0, child.chapters.findIndex((chapter) => chapter.chapterId === selectedId));
  const selected = chapters[selectedIndex];
  const selectedProgress = child.chapters[selectedIndex];
  const selectedNext = selectedProgress ? nextIndex(selectedProgress) : -1;

  return (
    <main className="child-page">
      <TeacherNav current="class" />
      <p className="child-page__backline">{back}</p>
      <div className="child-page__heading">
        <h1>{`${number} ${name ?? CLASS_COPY.noName}`}</h1>
        <p className="child-page__studied">
          {child.lastStudiedOn === null && <span className="child-page__norecord">{CLASS_COPY.noRecord}</span>}
          {CLASS_COPY.lastStudied} {formatStudiedOn(child.lastStudiedOn)}
        </p>
      </div>
      <div className="child-page__body">
        <div className="child-page__cards">
          {child.chapters.map((progress, index) => {
            const chapter = chapters[index];
            const tab = plainText(chapter?.tab ?? "");
            const next = nextIndex(progress);
            return (
              <button
                key={progress.chapterId}
                type="button"
                className="child-page__card"
                aria-pressed={progress.chapterId === selectedId}
                onClick={() => setPicked(progress.chapterId)}
              >
                <strong className="child-page__card-title">{tab}</strong>
                <ProgressCell label={tab} done={progress.doneSquares.length} total={progress.total} />
                <span className="child-page__card-next">
                  {next < 0 ? CLASS_COPY.allDone : CLASS_COPY.nextSquare(plainText(chapter?.items[next]?.title ?? ""))}
                </span>
              </button>
            );
          })}
        </div>
        <section className="child-page__squares">
          <h2>{plainText(selected?.title ?? "")}</h2>
          <ul>
            {(selected?.items ?? []).map((item, index) => {
              const done = selectedProgress?.doneSquares.includes(index) ?? false;
              return (
                <li key={index} className="child-page__square">
                  <span className="child-page__mark" aria-hidden="true">{done ? "✓" : index === selectedNext ? CLASS_COPY.next : ""}</span>
                  {done && <span className="child-page__vh">{CLASS_COPY.doneMark}</span>}
                  {!done && index === selectedNext && <span className="child-page__vh">{CLASS_COPY.next}</span>}
                  <span>{plainText(item.title)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
