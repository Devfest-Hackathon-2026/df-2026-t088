// 提出の記録はメモリに持つ。起動し直すと消え、見本に戻る（ADR-001、HM-13）
// 課題と時間割は先生が入れる（#196）。今はメモリ版。Firestore へは、この口（HomeStore）の中だけを差し替える
import { randomBytes } from "node:crypto";
import { CLASS_NUMBERS, seedAssignments, seedTimetable, toJstIso, type Assignment, type AssignmentLink, type TimetableDay, type TimetableSubjectId } from "./seed.ts";

export type SubmissionResult = { assignmentId: string; studentNumber: string; submittedAt: string | null; late: boolean };
export type AssignmentStatus = Assignment & { submittedCount: number; notSubmitted: string[]; late: string[] };
export type AssignmentInput = { subjectId: TimetableSubjectId; title: string; dueAt: string; link: AssignmentLink };

export type HomeStore = {
  now: () => string;
  assignments: () => Assignment[];
  timetable: () => TimetableDay[];
  hasStudent: (number: string) => boolean;
  findAssignment: (id: string) => Assignment | undefined;
  submittedAt: (assignmentId: string, number: string) => string | null;
  submit: (assignmentId: string, number: string) => SubmissionResult;
  withdraw: (assignmentId: string, number: string) => SubmissionResult;
  classStatus: () => AssignmentStatus[];
  // 先生の管理（#196）。書き込みは Firestore に替えるとき非同期になるので、今から Promise を返す
  addAssignment: (input: AssignmentInput) => Promise<Assignment>;
  updateAssignment: (id: string, input: AssignmentInput) => Promise<Assignment | undefined>;
  removeAssignment: (id: string) => Promise<{ removedSubmissions: number } | undefined>;
  replaceTimetable: (days: TimetableDay[]) => Promise<TimetableDay[]>;
  // 子どもの進み（仮。本線のマスを終えた位置を、章ごとに持つ）
  recordSquares: (number: string, chapterId: string, squares: number[], at: number) => void;
  classProgress: () => ProgressRow[];
};

/** 一人の子の進み。done は終えたマスの数、squares は終えた位置（0 から）。番号は CLASS_NUMBERS の順 */
export type ProgressRow = { number: string; lastStudiedOn: string | null; done: Record<string, number>; squares: Record<string, number[]> };

export function createHomeStore(options: { now?: () => number } = {}): HomeStore {
  const clock = options.now ?? Date.now;
  const assignments: Assignment[] = seedAssignments(clock());
  const timetable: TimetableDay[] = seedTimetable();
  const classNumbers = new Set(CLASS_NUMBERS);
  // キーは「提出物の id:番号」、値は出した時刻（epoch ms）
  const submissions = new Map<string, number>();
  // 子どもの進み：番号 → 章の id → 終えた位置。最後に学んだ時刻（epoch ms）は番号ごと
  const progress = new Map<string, Map<string, Set<number>>>();
  const studiedAt = new Map<string, number>();
  const key = (assignmentId: string, number: string) => `${assignmentId}:${number}`;
  const find = (id: string) => assignments.find((assignment) => assignment.id === id);
  const isLate = (assignment: Assignment, at: number) => at > Date.parse(assignment.dueAt);
  // 先生が配る課題の id。サーバが決める（hw- と英小文字・数字の8文字）
  const newId = () => `hw-${randomBytes(4).toString("hex")}`;

  return {
    now: () => toJstIso(clock()),
    assignments: () => assignments.map((assignment) => ({ ...assignment })),
    timetable: () => timetable.map((day) => ({ weekday: day.weekday, periods: day.periods.map((period) => ({ ...period })) })),
    hasStudent: (number) => classNumbers.has(number),
    findAssignment: find,
    submittedAt: (assignmentId, number) => {
      const at = submissions.get(key(assignmentId, number));
      return at === undefined ? null : toJstIso(at);
    },
    submit: (assignmentId, number) => {
      const assignment = find(assignmentId) as Assignment;
      // もう一度出しても、最初の時刻のまま（API-003）
      const at = submissions.get(key(assignmentId, number)) ?? clock();
      submissions.set(key(assignmentId, number), at);
      return { assignmentId, studentNumber: number, submittedAt: toJstIso(at), late: isLate(assignment, at) };
    },
    withdraw: (assignmentId, number) => {
      submissions.delete(key(assignmentId, number));
      return { assignmentId, studentNumber: number, submittedAt: null, late: false };
    },
    classStatus: () => [...assignments]
      .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))
      .map((assignment) => {
        const notSubmitted: string[] = [];
        const late: string[] = [];
        let submittedCount = 0;
        for (const number of CLASS_NUMBERS) {
          const at = submissions.get(key(assignment.id, number));
          if (at === undefined) notSubmitted.push(number);
          else {
            submittedCount += 1;
            if (isLate(assignment, at)) late.push(number);
          }
        }
        return { ...assignment, submittedCount, notSubmitted, late };
      }),
    addAssignment: async (input) => {
      const assignment: Assignment = { id: newId(), ...input };
      assignments.push(assignment);
      return { ...assignment };
    },
    updateAssignment: async (id, input) => {
      const current = find(id);
      if (!current) return undefined;
      // 項目を全部送って置き換える。id は変えない
      Object.assign(current, input);
      return { ...current };
    },
    removeAssignment: async (id) => {
      const index = assignments.findIndex((assignment) => assignment.id === id);
      if (index < 0) return undefined;
      assignments.splice(index, 1);
      // 課題を消すと、その課題の出した記録も消す（契約どおり）
      let removedSubmissions = 0;
      for (const recordKey of [...submissions.keys()]) {
        if (recordKey.startsWith(`${id}:`)) {
          submissions.delete(recordKey);
          removedSubmissions += 1;
        }
      }
      return { removedSubmissions };
    },
    replaceTimetable: async (days) => {
      timetable.splice(0, timetable.length, ...days.map((day) => ({ weekday: day.weekday, periods: day.periods.map((period) => ({ ...period })) })));
      return timetable.map((day) => ({ weekday: day.weekday, periods: day.periods.map((period) => ({ ...period })) }));
    },
    recordSquares: (number, chapterId, squares, at) => {
      let chapters = progress.get(number);
      if (!chapters) {
        chapters = new Map();
        progress.set(number, chapters);
      }
      let finished = chapters.get(chapterId);
      if (!finished) {
        finished = new Set();
        chapters.set(chapterId, finished);
      }
      // 同じマスを何度送っても1回と数える（Set）
      for (const square of squares) finished.add(square);
      studiedAt.set(number, Math.max(studiedAt.get(number) ?? 0, at));
    },
    classProgress: () =>
      CLASS_NUMBERS.map((number) => {
        const done: Record<string, number> = {};
        const squares: Record<string, number[]> = {};
        for (const [chapterId, finished] of progress.get(number) ?? []) {
          const sorted = [...finished].sort((left, right) => left - right);
          squares[chapterId] = sorted;
          done[chapterId] = sorted.length;
        }
        const at = studiedAt.get(number);
        return { number, lastStudiedOn: at === undefined ? null : toJstIso(at).slice(0, 10), done, squares };
      }),
  };
}
