import { describe, expect, it } from "vitest";
import {
  addDay,
  addPeriod,
  assignmentProblems,
  EMPTY_ASSIGNMENT_FORM,
  fromAssignment,
  MAX_DAYS,
  MAX_PERIODS,
  normalizeDays,
  removeDay,
  removePeriod,
  setSubject,
  sortByDue,
  subjectLabel,
  toAssignmentInput,
  visibleLength,
} from "./admin-model";
import type { AdminAssignment, TimetableDay } from "./api";
import { ASSIGNMENT_FORM_COPY, TIMETABLE_COPY } from "./copy";

const filled = {
  ...EMPTY_ASSIGNMENT_FORM,
  subjectId: "sansu",
  title: "  分数のたしざん  ",
  date: "2026-11-10",
  hour: "15",
  minute: "00",
};

describe("課題の入力の確かめ（押せない理由）", () => {
  it("空の入力は、教科・名前・日付・時刻の理由を項目ごとに 1 つ返す", () => {
    expect(assignmentProblems(EMPTY_ASSIGNMENT_FORM)).toEqual({
      subject: ASSIGNMENT_FORM_COPY.needSubject,
      title: ASSIGNMENT_FORM_COPY.needName,
      date: ASSIGNMENT_FORM_COPY.needDate,
      time: ASSIGNMENT_FORM_COPY.needTime,
    });
  });

  it("名前は、ふりがなを除いて 20 字を超えると理由を返す", () => {
    expect(visibleLength("[算数|さんすう]のテスト")).toBe(6);
    expect(assignmentProblems({ ...filled, title: "あ".repeat(20) }).title).toBeUndefined();
    expect(assignmentProblems({ ...filled, title: "あ".repeat(21) }).title).toBe(ASSIGNMENT_FORM_COPY.nameTooLong);
  });

  it("章のテストとつなぐのに章を選んでいないと、章の理由を返す", () => {
    expect(assignmentProblems({ ...filled, linkKind: "chapterTest" }).chapter).toBe(ASSIGNMENT_FORM_COPY.needChapter);
    expect(assignmentProblems(filled)).toEqual({});
  });
});

describe("送る値", () => {
  it("名前の前後の空白を消し、期限を +09:00 の分までの形にする", () => {
    expect(toAssignmentInput(filled)).toEqual({
      subjectId: "sansu",
      title: "分数のたしざん",
      dueAt: "2026-11-10T15:00+09:00",
      link: null,
    });
  });

  it("章のテストとつなぐときは、link に章 id を入れる", () => {
    const input = toAssignmentInput({ ...filled, linkKind: "chapterTest", chapterId: "integer" });
    expect(input.link).toEqual({ kind: "chapterTest", chapterId: "integer" });
  });

  it("直すときは、今の値を入力に戻す（期限の日付と時と分）", () => {
    const assignment: AdminAssignment = {
      id: "a-1",
      subjectId: "rika",
      title: "てこ",
      dueAt: "2026-11-12T08:05:00+09:00",
      link: { kind: "chapterTest", chapterId: "decimal" },
    };
    expect(fromAssignment(assignment)).toEqual({
      subjectId: "rika",
      title: "てこ",
      date: "2026-11-12",
      hour: "08",
      minute: "05",
      linkKind: "chapterTest",
      chapterId: "decimal",
    });
  });

  it("一覧は期限の早い順に並ぶ", () => {
    const base = { subjectId: "sansu", title: "x", link: null };
    const sorted = sortByDue([
      { ...base, id: "b", dueAt: "2026-11-12T08:00:00+09:00" },
      { ...base, id: "a", dueAt: "2026-11-10T15:00:00+09:00" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("教科と章の表示", () => {
  it("教科の名前は漢字で出し、道徳などの 3 つも名前がある", () => {
    expect(subjectLabel("kokugo")).toBe("国語");
    expect(subjectLabel("doutoku")).toBe("道徳");
    expect(subjectLabel("gakkatsu")).toBe("学級活動");
  });

});

describe("時間割の操作", () => {
  const days: TimetableDay[] = [
    { weekday: 1, periods: [{ period: 1, subjectId: "kokugo" }, { period: 2, subjectId: "sansu" }] },
    { weekday: 2, periods: [{ period: 1, subjectId: "rika" }] },
  ];

  it("曜日を増やすと、新しい列は最後の列のコマを写す。7 つまで", () => {
    const next = addDay(days).days;
    expect(next[2]).toEqual({ weekday: 3, periods: [{ period: 1, subjectId: "rika" }] });
    const full = Array.from({ length: MAX_DAYS }, (_, index) => ({ weekday: index + 1, periods: [{ period: 1, subjectId: "kokugo" }] }));
    expect(addDay(full)).toEqual({ days: full, problem: TIMETABLE_COPY.maxDays });
  });

  it("曜日を減らすと、いちばん後ろの列を外す。1 つは残す", () => {
    expect(removeDay(days).days.map((day) => day.weekday)).toEqual([1]);
    expect(removeDay([days[0]!])).toEqual({ days: [days[0]], problem: TIMETABLE_COPY.minDays });
  });

  it("コマを増やすのは曜日ごと。8 つまで、直前のコマの教科を写す", () => {
    const next = addPeriod(days, 1).days;
    expect(next[1]?.periods.map((period) => period.period)).toEqual([1, 2]);
    expect(next[1]?.periods[1]?.subjectId).toBe("rika");
    const full = [{ weekday: 1, periods: Array.from({ length: MAX_PERIODS }, (_, index) => ({ period: index + 1, subjectId: "kokugo" })) }];
    expect(addPeriod(full, 0).problem).toBe(TIMETABLE_COPY.maxPeriods);
  });

  it("コマを減らすのは曜日ごと。1 つは残す", () => {
    expect(removePeriod(days, 0).days[0]?.periods).toHaveLength(1);
    expect(removePeriod(days, 1).problem).toBe(TIMETABLE_COPY.minPeriods);
  });

  it("教科を変えると、その 1 コマだけが変わる。並べ直すと曜日は 1 から連続する", () => {
    const changed = setSubject(days, 0, 1, "eigo");
    expect(changed[0]?.periods[1]?.subjectId).toBe("eigo");
    expect(changed[1]).toEqual(days[1]);
    const shuffled = normalizeDays([{ weekday: 3, periods: [{ period: 1, subjectId: "eigo" }] }, { weekday: 1, periods: [] }]);
    expect(shuffled.map((day) => day.weekday)).toEqual([1, 2]);
  });
});
