// 「学級のようす」の「子どもの進み」タブ（SCR-T10）。保存した進み（API）を表にする。初めは番号順。列見出しで並べ替え（#538）、「今日学んだ子だけ」で絞る。記録が無い子は空のまま
import { useMemo, useState, type CSSProperties } from "react";
import type { SubjectId } from "../data/types";
import { plainText } from "../ruby-text";
import { ProgressCell } from "./ProgressCell";
import { ADMIN_COPY, CLASS_COPY, STUDENT_ACCOUNT_COPY, TODAY_COPY } from "./copy";
import { formatStudiedOn, sampleChapters, subjectQuery } from "./progress-model";
import { loadRoster, sampleRoster, type Roster } from "./roster";
import { useClassProgress } from "./use-class-progress";
import "./ProgressPanel.css";

/** 名前を引く。端末の名簿が先、無ければ見本の名前。どちらにも無い番号は undefined */
export function nameOf(number: string, local: Roster = loadRoster(), sample: Roster = sampleRoster()): string | undefined {
  return local[number] ?? sample[number];
}

type SortKey = "number" | "name" | "studied";
type SortState = { key: SortKey; desc: boolean };

export function ProgressPanel({ reloadKey, subjectId = "sansu" }: { reloadKey: number; subjectId?: SubjectId }) {
  // reloadKey が変わったら、名簿と進みを読み直す
  const state = useClassProgress(reloadKey, subjectId);
  const local = useMemo(() => loadRoster(), [reloadKey]);
  const sample = useMemo(() => sampleRoster(), []);
  const chapters = useMemo(() => sampleChapters(subjectId), [subjectId]);
  // 並べ替えと絞り込みは、画面を開き直すまで（端末には残さない）。初めは番号の昇順・全員
  const [sort, setSort] = useState<SortState>({ key: "number", desc: false });
  const [todayOnly, setTodayOnly] = useState(false);

  if (state.status === "loading") return <p role="status">{TODAY_COPY.loading}</p>;
  if (state.status === "error") {
    return <p role="alert" className="progress-panel__error">{state.code === "UNAUTHORIZED" ? ADMIN_COPY.notAuthorized : TODAY_COPY.connError}</p>;
  }
  const { progress } = state;
  const students = [...progress.students].sort((a, b) => a.number.localeCompare(b.number));
  // 今日（サーバの now の日付）学んだ人。朝に今日の子を拾うための数（#377）
  const today = progress.now.slice(0, 10);
  const studiedToday = students.filter((student) => student.lastStudiedOn === today).length;

  // 並べ替え：同じ値のときは番号の昇順で並べる（安定させる）
  const keyOf = (student: (typeof students)[number]): string => {
    if (sort.key === "name") return nameOf(student.number, local, sample) ?? "";
    if (sort.key === "studied") return student.lastStudiedOn ?? "";
    return student.number;
  };
  const shown = students
    .filter((student) => !todayOnly || student.lastStudiedOn === today)
    .sort((a, b) => {
      const order = keyOf(a).localeCompare(keyOf(b), "ja") || a.number.localeCompare(b.number);
      return sort.desc ? -order : order;
    });

  const toggleSort = (key: SortKey) => setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: false }));
  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" => (sort.key === key ? (sort.desc ? "descending" : "ascending") : "none");
  const arrow = (key: SortKey) => (sort.key === key ? <span aria-hidden="true">{sort.desc ? " ▼" : " ▲"}</span> : null);

  return (
    <div className="progress-panel">
      <p className="progress-panel__note">{CLASS_COPY.progressNote}</p>
      {students.length === 0 ? (
        <p role="status">{CLASS_COPY.noStudents}</p>
      ) : (
        <>
        <div className="progress-panel__bar">
          <p role="status">{CLASS_COPY.studiedToday(studiedToday, students.length)}</p>
          <label className="progress-panel__filter">
            <input type="checkbox" checked={todayOnly} onChange={(event) => setTodayOnly(event.target.checked)} />
            {CLASS_COPY.todayOnly}
          </label>
        </div>
        {shown.length === 0 ? <p role="status">{CLASS_COPY.noTodayStudied}</p> : null}
        <div key={subjectId} className="progress-panel__scroll">
          <table className="progress-panel__table" style={{ "--progress-count": chapters.length } as CSSProperties}>
            <colgroup>
              <col className="progress-panel__c-number" />
              <col className="progress-panel__c-name" />
              {chapters.map((chapter) => (
                <col key={chapter.id} className="progress-panel__c-chapter" />
              ))}
              <col className="progress-panel__c-date" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort("number")} className="progress-panel__sticky progress-panel__sticky--number">
                  <button type="button" className="progress-panel__sort" onClick={() => toggleSort("number")}>{STUDENT_ACCOUNT_COPY.colNumber}{arrow("number")}</button>
                </th>
                <th scope="col" aria-sort={ariaSort("name")} className="progress-panel__sticky progress-panel__sticky--name">
                  <button type="button" className="progress-panel__sort" onClick={() => toggleSort("name")}>{STUDENT_ACCOUNT_COPY.colName}{arrow("name")}</button>
                </th>
                {chapters.map((chapter) => (
                  <th key={chapter.id} scope="col" title={plainText(chapter.title)}>
                    <span className="progress-panel__chapter">{plainText(chapter.tab)}</span>
                  </th>
                ))}
                <th scope="col" aria-sort={ariaSort("studied")}>
                  <button type="button" className="progress-panel__sort" onClick={() => toggleSort("studied")}>{CLASS_COPY.lastStudied}{arrow("studied")}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((student) => {
                const name = nameOf(student.number, local, sample);
                return (
                  <tr key={student.number} className="progress-panel__row">
                    <td className="progress-panel__sticky progress-panel__sticky--number">
                      <a
                        href={`?view=child&number=${encodeURIComponent(student.number)}${subjectQuery(subjectId) ? `&${subjectQuery(subjectId)}` : ""}`}
                        aria-label={CLASS_COPY.rowLabel(student.number, name ?? CLASS_COPY.noNameLabel)}
                      >
                        {student.number}
                      </a>
                    </td>
                    <td className="progress-panel__sticky progress-panel__sticky--name">{name ?? CLASS_COPY.noName}</td>
                    {progress.chapters.map((chapter, index) => (
                      <td key={chapter.chapterId} className="progress-panel__cell">
                        <ProgressCell
                          label={plainText(chapters[index]?.tab ?? "")}
                          done={student.done[chapter.chapterId] ?? 0}
                          total={chapter.total}
                          numbers={false}
                        />
                      </td>
                    ))}
                    <td>{formatStudiedOn(student.lastStudiedOn)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
