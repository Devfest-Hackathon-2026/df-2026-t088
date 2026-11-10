// 課題の入れ方（SCR-T07、#196）。新しく配る と 直す の共通。押せない理由は、disabled ではなく入力欄の下に書く。
// 保存に失敗したら入力を残す。保存できたら、SCR-T06 に戻って「配りました」「直しました」を出す
import { useEffect, useRef, useState } from "react";
import { assignmentProblems, EMPTY_ASSIGNMENT_FORM, fromAssignment, HOURS, MINUTES, subjectLabel, toAssignmentInput, visibleLength, type AssignmentField, type AssignmentForm } from "./admin-model";
import { ADMIN_COPY, ASSIGNMENT_FORM_COPY, ASSIGNMENTS_COPY } from "./copy";
import { AdminApiError, createAssignment, listAdminAssignments, readLinkOptions, readTimetable, updateAssignment, type InputDetail } from "./api";
import { displayText } from "../ruby-text";
import { TeacherNav } from "./TeacherNav";
import "./AdminPages.css";

type Load =
  | { status: "loading" }
  | { status: "error"; code: string }
  | { status: "notFound" }
  | { status: "ready"; subjects: string[]; chapters: { chapterId: string; name: string }[] };

const errorCode = (error: unknown) => (error instanceof AdminApiError ? error.code : "NETWORK");

// サーバーが返した項目ごとの理由を、画面の欄に結ぶ（欄の名前は API の項目名）
export function fieldProblemsFrom(details: InputDetail[]): Partial<Record<AssignmentField, string>> {
  const problems: Partial<Record<AssignmentField, string>> = {};
  for (const detail of details) {
    if (detail.field === "subjectId") problems.subject = ASSIGNMENT_FORM_COPY.needSubject;
    else if (detail.field === "title") problems.title = detail.reason === "too_long" ? ASSIGNMENT_FORM_COPY.nameTooLong : ASSIGNMENT_FORM_COPY.needName;
    else if (detail.field === "dueAt") problems.date = ASSIGNMENT_FORM_COPY.needDate;
    else if (detail.field.startsWith("link")) problems.chapter = ASSIGNMENT_FORM_COPY.needChapter;
  }
  return problems;
}

/** 配る・直すの画面。id があれば直す（今の値を入れて開く）、なければ新しく配る */
export function AssignmentFormPage({ id, navigate = (href: string) => window.location.assign(href) }: { id?: string; navigate?: (href: string) => void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [form, setForm] = useState<AssignmentForm>(EMPTY_ASSIGNMENT_FORM);
  const [shown, setShown] = useState<Partial<Record<AssignmentField, true>>>({});
  const [attempted, setAttempted] = useState(false);
  const [serverProblems, setServerProblems] = useState<Partial<Record<AssignmentField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const requests = [readTimetable(), id ? listAdminAssignments() : Promise.resolve(null), readLinkOptions()] as const;
    Promise.all(requests)
      .then(([timetable, list, links]) => {
        if (!alive) return;
        if (id) {
          const found = list?.assignments.find((item) => item.id === id);
          if (!found) {
            setLoad({ status: "notFound" });
            return;
          }
          setForm(fromAssignment(found));
        }
        setLoad({ status: "ready", subjects: timetable.subjects, chapters: links.chapters });
      })
      .catch((error: unknown) => {
        if (alive) setLoad({ status: "error", code: errorCode(error) });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const problems = assignmentProblems(form);
  const messageFor = (field: AssignmentField): string | undefined => (attempted || shown[field] ? (problems[field] ?? serverProblems[field]) : undefined);
  const update = (field: AssignmentField, change: Partial<AssignmentForm>) => {
    setForm((current) => ({ ...current, ...change }));
    setShown((current) => ({ ...current, [field]: true }));
    setServerProblems((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    if (savingRef.current) return; // 保存中は、もう一度押しても送らない（disabled は使わない）
    setAttempted(true);
    setSaveError("");
    if (Object.keys(assignmentProblems(form)).length > 0) return;
    savingRef.current = true;
    setSaving(true);
    const input = toAssignmentInput(form);
    try {
      if (id) await updateAssignment(id, input);
      else await createAssignment(input);
      navigate(`?view=assignments&done=${id ? "updated" : "added"}&title=${encodeURIComponent(input.title)}`);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ADULT_INVALID_REQUEST") {
        setSaveError(ADMIN_COPY.invalidInput);
        setServerProblems(fieldProblemsFrom(error instanceof AdminApiError ? error.details : []));
      } else if (code === "LOGIN_REQUIRED") setSaveError(ADMIN_COPY.loginRequired);
      else if (code === "ADULT_ASSIGNMENT_NOT_FOUND") setSaveError(ASSIGNMENT_FORM_COPY.notFound);
      else if (code === "UNAUTHORIZED") setSaveError(ADMIN_COPY.notAuthorized);
      else setSaveError(ASSIGNMENT_FORM_COPY.saveFailed);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const titleLength = visibleLength(form.title.trim());
  const problemText = (field: AssignmentField) => {
    const text = messageFor(field);
    return text ? <p id={`assignment-${field}-problem`} className="admin-page__problem">{text}</p> : null;
  };
  const invalid = (field: AssignmentField) => (messageFor(field) ? true : undefined);
  const described = (field: AssignmentField) => (messageFor(field) ? `assignment-${field}-problem` : undefined);

  return (
    <main className="admin-page">
      <TeacherNav current="assignments" />
      <h1>{id ? ASSIGNMENT_FORM_COPY.titleEdit : ASSIGNMENT_FORM_COPY.titleNew}</h1>

      {load.status === "loading" && <p role="status">{ASSIGNMENTS_COPY.loading}</p>}
      {load.status === "error" && (
        <p role="alert" className="admin-page__error">
          {load.code === "UNAUTHORIZED" ? ADMIN_COPY.notAuthorized : ASSIGNMENTS_COPY.connError}
        </p>
      )}
      {load.status === "notFound" && <p role="alert" className="admin-page__error">{ASSIGNMENT_FORM_COPY.notFound}</p>}
      {(load.status === "error" || load.status === "notFound") && (
        <p>
          <a className="admin-page__button" href="?view=assignments">{ASSIGNMENT_FORM_COPY.cancel}</a>
        </p>
      )}

      {load.status === "ready" && (
        <form className="admin-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="admin-form__field">
            <label htmlFor="assignment-subject">{ASSIGNMENT_FORM_COPY.colSubject}</label>
            <select id="assignment-subject" value={form.subjectId} aria-invalid={invalid("subject")} aria-describedby={described("subject")} onChange={(event) => update("subject", { subjectId: event.target.value })}>
              <option value="">{ADMIN_COPY.chooseHint}</option>
              {load.subjects.map((subjectId) => (
                <option key={subjectId} value={subjectId}>{subjectLabel(subjectId)}</option>
              ))}
            </select>
            {problemText("subject")}
          </div>

          <div className="admin-form__field">
            <label htmlFor="assignment-title">{ASSIGNMENT_FORM_COPY.colName}</label>
            <input id="assignment-title" type="text" value={form.title} aria-invalid={invalid("title")} aria-describedby={described("title")} onChange={(event) => update("title", { title: event.target.value })} />
            <p className="admin-form__note">{ASSIGNMENT_FORM_COPY.count(titleLength)}</p>
            <p className="admin-form__note">{ASSIGNMENT_FORM_COPY.rubyNote}</p>
            {problemText("title")}
          </div>

          <div className="admin-form__field">
            <label htmlFor="assignment-date">{ASSIGNMENT_FORM_COPY.colDueDate}</label>
            <input id="assignment-date" type="date" value={form.date} aria-invalid={invalid("date")} aria-describedby={described("date")} onChange={(event) => update("date", { date: event.target.value })} />
            {problemText("date")}
          </div>

          <div className="admin-form__field" role="group" aria-label={ASSIGNMENT_FORM_COPY.colDueTime}>
            <span className="admin-form__row">
              <label htmlFor="assignment-hour">{ASSIGNMENT_FORM_COPY.hour}</label>
              <select id="assignment-hour" value={form.hour} aria-invalid={invalid("time")} aria-describedby={described("time")} onChange={(event) => update("time", { hour: event.target.value })}>
                <option value="">{ADMIN_COPY.chooseHint}</option>
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <label htmlFor="assignment-minute">{ASSIGNMENT_FORM_COPY.minute}</label>
              <select id="assignment-minute" value={form.minute} aria-invalid={invalid("time")} aria-describedby={described("time")} onChange={(event) => update("time", { minute: event.target.value })}>
                <option value="">{ADMIN_COPY.chooseHint}</option>
                {MINUTES.map((minute) => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
            </span>
            {problemText("time")}
          </div>

          <fieldset className="admin-form__fieldset">
            <legend>{ASSIGNMENT_FORM_COPY.colLink}</legend>
            <label>
              <input type="radio" name="assignment-link" checked={form.linkKind === "none"} onChange={() => update("chapter", { linkKind: "none", chapterId: "" })} />
              {ASSIGNMENT_FORM_COPY.linkNone}
            </label>
            <label>
              <input type="radio" name="assignment-link" checked={form.linkKind === "chapterTest"} onChange={() => update("chapter", { linkKind: "chapterTest" })} />
              {ASSIGNMENT_FORM_COPY.linkChapter}
            </label>
            {form.linkKind === "chapterTest" && (
              <div className="admin-form__field">
                <label htmlFor="assignment-chapter">{ASSIGNMENT_FORM_COPY.colChapter}</label>
                <select id="assignment-chapter" value={form.chapterId} aria-invalid={invalid("chapter")} aria-describedby={described("chapter")} onChange={(event) => update("chapter", { chapterId: event.target.value })}>
                  <option value="">{ADMIN_COPY.chooseHint}</option>
                  {load.chapters.map((chapter) => (
                    <option key={chapter.chapterId} value={chapter.chapterId}>{displayText(chapter.name, null)}</option>
                  ))}
                </select>
                {problemText("chapter")}
              </div>
            )}
          </fieldset>

          {saving && <p role="status">{ADMIN_COPY.saving}</p>}
          {saveError && <p role="alert" className="admin-page__error">{saveError}</p>}

          <div className="admin-page__actions">
            <button type="submit">{ASSIGNMENT_FORM_COPY.save}</button>
            <button type="button" onClick={() => navigate("?view=assignments")}>{ASSIGNMENT_FORM_COPY.cancel}</button>
          </div>
        </form>
      )}
    </main>
  );
}
