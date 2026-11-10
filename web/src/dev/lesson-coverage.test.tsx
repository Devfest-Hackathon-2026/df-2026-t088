import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { lessonCatalog } from "./lesson-catalog";
import { DeveloperLessonPreview } from "./DeveloperLessons";
import { GRADES } from "../data/kanji-grades";
import { PreviewGradeProvider } from "../grade";
import { hasMathLesson } from "../game/lesson-gateway";
import type { Game } from "../game/use-game";
import { targetOf } from "../pages/lesson/lesson-common";
import { TileLessonPage } from "../pages/lesson/TileLessonPage";

afterEach(cleanup);
const lessons = GRADES.flatMap((grade) => lessonCatalog(grade).flatMap(({ entries }) => entries
  .filter((entry) => entry.count > 0).map((entry) => ({ grade, entry, name: `${grade}年/${entry.chapter.id}/${entry.key}` }))));

describe("1〜6年の実装済み教材を未クリアのまま表示", () => {
  it.each(lessons)("$name の全問題が描画でき、進捗を保存しない", ({ grade, entry }) => {
    const before = JSON.stringify(localStorage);
    for (let index = 0; index < entry.count; index++) {
      const view = render(<PreviewGradeProvider grade={grade}><DeveloperLessonPreview entry={entry} index={index} onExit={() => {}} onFinish={() => {}} /></PreviewGradeProvider>);
      expect(view.container.querySelector("main, section")).not.toBeNull();
      expect(view.container.querySelector("input, button")).not.toBeNull();
      expect(view.container.textContent).not.toContain("いま じゅんびしています");
      expect(view.container.querySelectorAll(".developer-entry")).toHaveLength(0);
      view.unmount();
    }
    expect(JSON.stringify(localStorage)).toBe(before);
  });
});

describe("生徒用の算数", () => {
  it.each(GRADES)("%i年の全マスで開発者プレビューと同じ教材を検出する", (grade) => {
    for (const { chapter, entries } of lessonCatalog(grade)) {
      for (const entry of entries) {
        const target = targetOf(entry.key, chapter)!;
        expect(hasMathLesson(chapter.id, target), `${chapter.id}/${entry.key}`).toBe(entry.count > 0);
      }
    }
  });

  it.each(lessons)("$name を生徒用の画面で開ける", ({ grade, entry }) => {
    const { chapter, key } = entry;
    const target = targetOf(key, chapter)!;
    const game = {
      chapter,
      chapterProgress: { done: target.kind === "main" ? target.index : chapter.items.length, sides: [], test: false },
    } as unknown as Game;
    const view = render(<PreviewGradeProvider grade={grade}><TileLessonPage game={game} lessonKey={key} /></PreviewGradeProvider>);
    expect(view.container.querySelector("main, section")).not.toBeNull();
    expect(view.container.querySelector("input, button")).not.toBeNull();
  });
});
