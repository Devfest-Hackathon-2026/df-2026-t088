import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DeveloperLessons from "./DeveloperLessons";
import { lessonCatalog } from "./lesson-catalog";
import type { Grade } from "../data/kanji-grades";
import { conceptFor } from "../lesson/upper-concepts";
import { displayText } from "../ruby-text";

afterEach(cleanup);
describe("開発者の教材確認", () => {
  it("未回答で前後の問題に移動でき、保存済みの進捗と学年を変えない", () => {
    localStorage.setItem("sugoroku:grade", "5");
    localStorage.setItem("sugoroku-lesson-resume", '{"fraction-main-6":2}');
    const before = JSON.stringify(localStorage);
    render(<DeveloperLessons onClose={() => {}} />);

    fireEvent.click(document.querySelector(".developer-lessons__catalog button")!);
    expect(document.querySelector("#grade-one-answer")).not.toBeNull();
    const first = document.querySelector(".grade-one h1")?.textContent;
    fireEvent.click(screen.getByRole("button", { name: "次の問題（開発者）" }));
    expect(document.querySelector(".grade-one h1")?.textContent).not.toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "前の問題（開発者）" }));
    expect(document.querySelector(".grade-one h1")?.textContent).toBe(first);
    expect(JSON.stringify(localStorage)).toBe(before);
  });
  it("章のテストの後半も、前の問題を解かずに開ける", () => {
    render(<DeveloperLessons onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("学年"), { target: { value: "6" } });
    const entry = lessonCatalog(6).flatMap((group) => group.entries).find((entry) => entry.test && entry.count > 1)!;
    fireEvent.click(screen.getByRole("button", { name: `${displayText(entry.title, 6)} — ${entry.count}問` }));
    fireEvent.change(screen.getByLabelText("問題へ移動"), { target: { value: "1" } });
    expect(screen.getByText(entry.uppers[1].problem)).toBeTruthy();
    for (const input of document.querySelectorAll<HTMLInputElement>("form input")) {
      expect(input.value).toBe("");
    }
  });
  it("分数の未回答問題も移動でき、通常の再開位置は変わらない", () => {
    localStorage.setItem("sugoroku-lesson-resume", '{"fraction-main-6":2}');
    const before = JSON.stringify(localStorage);
    render(<DeveloperLessons onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("学年"), { target: { value: "5" } });
    const entry = lessonCatalog(5).flatMap((group) => group.entries).find((entry) => entry.chapter.id === "fraction" && entry.key === "main-6")!;
    // 一覧は対象学年の表示に合わせて読みが変わるので、対応するマスを選ぶ。
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".developer-lessons__catalog button")];
    const entries = lessonCatalog(5).flatMap((group) => group.entries);
    fireEvent.click(buttons[entries.findIndex((item) => item.chapter.id === entry.chapter.id && item.key === entry.key)]);
    fireEvent.change(screen.getByLabelText(/^こたえ/), { target: { value: "1/2" } });
    fireEvent.click(screen.getByRole("button", { name: "次の問題（開発者）" }));
    expect((screen.getByLabelText(/^こたえ/) as HTMLInputElement).value).toBe("");
    expect(JSON.stringify(localStorage)).toBe(before);
  });
  it("6年生までの全マスを列挙し、未実装を区別する", () => {
    for (const grade of [1, 2, 3, 4, 5, 6] as Grade[]) {
      const catalog = lessonCatalog(grade);
      expect(catalog.length).toBeGreaterThan(0);
      for (const { chapter, entries } of catalog) {
        expect(entries.length).toBe(chapter.items.length + chapter.sides.length + 1);
        for (const entry of entries) expect(Number.isInteger(entry.count)).toBe(true);
      }
    }
  });
  it("教材監査用の集計", () => {
    const rows = ([1, 2, 3, 4, 5, 6] as Grade[]).map((grade) => {
      const entries = lessonCatalog(grade).flatMap((group) => group.entries);
      return { grade, total: entries.length, implemented: entries.filter((entry) => entry.count).length,
        missing: entries.filter((entry) => !entry.count).map((entry) => `${entry.chapter.id}/${entry.key}: ${entry.title}`),
        conceptsMissing: [...new Set(entries.flatMap((entry) => entry.uppers.filter((q) => q.title !== "偶数と奇数" && !conceptFor(q)).map((q) => q.title)))],
        figuresMissing: entries.flatMap((entry) => entry.twos.filter((q) => !q.visual && !q.figures.length).map((q) => q.title)),
      };
    });
    expect(rows.every((row) => row.implemented <= row.total)).toBe(true);
    expect(rows.flatMap((row) => row.conceptsMissing)).toEqual([]);
    expect(rows).toHaveLength(6);
  });
});
