import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { plainText } from "../../ruby-text";
import { findAnyChapter } from "../../data";
import type { GameState } from "../../data";
import { MIDWAY_STATE } from "../../game/test-state";
import { useGame } from "../../game/use-game";
import { BoardPage } from "./BoardPage";

// 6年（初めの学年。DEFAULT_GRADE）の章のマスの名前を確かめる。BoardPage.test.tsx は5年の分数の教材のために学年を5年にしている。
// 6年の章は学習指導要領の本文から生成した物で、名前は kid-cell-names の表で子ども向けに替えている（#416、C-35）

function Harness() {
  const game = useGame();
  return <BoardPage game={game} onOpenChapters={vi.fn()} />;
}

const SEEN: GameState = { ...MIDWAY_STATE, introSeen: true, sansuSelected: true };
const road = () => screen.getByRole("region", { name: "すごろくの盤面" });
const cellNames = () =>
  within(road()).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? "").filter((name) => /^\dマス目/.test(name));

beforeEach(() => {
  localStorage.clear();
});

describe("6年の盤面のマスの名前（#416）", () => {
  it("分数の乗法・除法の章：4 マスの aria-label と今のマスのカードに、学習指導要領の文が出ない", () => {
    const chapter = findAnyChapter("sansu-6-01")!;
    const state = { ...SEEN, chapterId: "sansu-6-01", progress: { ...SEEN.progress, "sansu-6-01": { done: 0, sides: [], test: false } } };
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(state));
    render(<Harness />);
    const names = cellNames();
    expect(names).toHaveLength(4);
    for (const name of names) expect(name).not.toMatch(/身に付ける|次のような|及び|こと。|理解すること|乗数や除数/);
    expect(plainText(chapter.items[0]!.title)).toBe("かけ算・わり算の意味");
    expect(names[0]).toContain("かけ算・わり算の意味");
    const card = screen.getByRole("complementary").textContent ?? "";
    expect(card).not.toMatch(/身に付ける|次のような|及び|乗数や除数/);
  });
});
