import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { parseSubject } from "./progress-model";
import { ClassPage } from "./ClassPage";
import { ChildPage } from "./ChildPage";
import { UnitPage } from "./UnitPage";
import { ProblemPage } from "./ProblemPage";
import { DecidePage } from "./DecidePage";
import { SubmissionsPage } from "./SubmissionsPage";
import { AssignmentsPage, type DoneNotice } from "./AssignmentsPage";
import { AssignmentFormPage } from "./AssignmentFormPage";
import { TimetablePage } from "./TimetablePage";
import { PrintHandoutPage } from "./PrintHandoutPage";
import { ProblemOrderPage } from "./ProblemOrderPage";
import { MembersPage } from "./MembersPage";
import { NAMED_PATTERNS } from "../research/api";
import { TeacherGate } from "./TeacherGate";
import "../styles/tokens.css";
import "../styles/base.css";

// 先生の画面（デモ）の入口。大人向けの研究画面（research/）とは別で、子どもの画面の道には触れない
const root = document.getElementById("root");
if (!root) throw new Error("#root が見つかりません");

// ?lesson=&problem=&pattern= があれば直し方の承認（SCR-T03）、?lesson=&problem= なら問題の詳細（SCR-T02）、
// ?view=unit&chapter=&lesson= なら単元の問題の一覧（SCR-T11。&period=today）、&from=unit&chapter= 付きの SCR-T02 は戻る先が SCR-T11
// ?view=child&number= なら子どもの進み（SCR-T04）、なければ学級のようす（SCR-T10。?tab=progress、?tab=progress&subject=rika、?period=today）；?view=child は &subject=rika も
const params = new URLSearchParams(window.location.search);
const lessonKey = params.get("lesson");
const problem = params.get("problem");
const pattern = params.get("pattern");
const named = NAMED_PATTERNS.find((value) => value === pattern) ?? null;
// ?view=submissions なら提出の状況（SCR-T05、#187）
const view = params.get("view");
const childNumber = params.get("number");
const tabParam = params.get("tab");
const initialTab = tabParam === "progress" || tabParam === "loop" ? tabParam : "stumbles";
const subject = parseSubject(params.get("subject"));
const initialPeriod: "today" | "7days" = params.get("period") === "today" ? "today" : "7days";
// ?view=assignments（SCR-T06）、?view=assignment（SCR-T07。&id= があれば直す）、?view=timetable（SCR-T08、#196）
const assignmentId = params.get("id");
const done = params.get("done");
const chapterParam = params.get("chapter");
const unitLessonParam = params.get("lesson");
const backTo = params.get("from") === "unit" && chapterParam && lessonKey ? { chapterId: chapterParam, lessonKey, period: initialPeriod } : undefined;
const doneTitle = params.get("title") ?? "";
const doneNotice: DoneNotice | null = done === "added" || done === "updated" ? { kind: done, title: doneTitle } : null;
if (doneNotice) window.history.replaceState(null, "", "?view=assignments");

// 先生のログインが on のときは、どの画面も先にログインを求める（off のときは、そのまま出す）
createRoot(root).render(
  <StrictMode>
    <TeacherGate>
      {view === "submissions" ? (
        <SubmissionsPage />
      ) : view === "assignments" ? (
        <AssignmentsPage done={doneNotice} />
      ) : view === "assignment" ? (
        <AssignmentFormPage key={assignmentId ?? "new"} id={assignmentId ?? undefined} />
      ) : view === "timetable" ? (
        <TimetablePage />
      ) : view === "print" ? (
        <PrintHandoutPage />
      ) : view === "problem-order" ? (
        <ProblemOrderPage />
      ) : view === "members" ? (
        <MembersPage />
      ) : view === "unit" && chapterParam && unitLessonParam ? (
        <UnitPage chapterId={chapterParam} lessonKey={unitLessonParam} period={initialPeriod} />
      ) : view === "child" && childNumber ? (
        <ChildPage number={childNumber} subjectId={subject} />
      ) : lessonKey && problem && named ? (
        <DecidePage lessonKey={lessonKey} problem={problem} pattern={named} />
      ) : lessonKey && problem ? (
        <ProblemPage lessonKey={lessonKey} problem={problem} backTo={backTo} />
      ) : (
        <ClassPage initialTab={initialTab} initialPeriod={initialPeriod} initialSubject={subject} />
      )}
    </TeacherGate>
  </StrictMode>,
);
