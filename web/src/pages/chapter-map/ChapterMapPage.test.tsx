import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../copy";
import { CHAPTERS, chaptersOf } from "../../data";
import type { Chapter, GameState } from "../../data";
import { MIDWAY_STATE } from "../../game/test-state";
import { useGame } from "../../game/use-game";
import { ACCOUNT_KEY } from "../../account";
import { GradeProvider } from "../../grade";
import { plainText } from "../../ruby-text";
import { saveGrade5ForTest } from "../../test-grade";
import { ChapterMapPage } from "./ChapterMapPage";
import { roadRows, roadSpot } from "./layout";

const SEEN: GameState = { ...MIDWAY_STATE, introSeen: true, sansuSelected: true };

// この画面は退避中で、画面からは使わない（D-130）。算数の章には鍵が無くなったので、鍵の札は lockedId で作る
function Harness({ lockedId }: { lockedId?: string }) {
  const game = useGame();
  const shown = lockedId === undefined ? game : { ...game, isChapterOpen: (chapter: Chapter) => chapter.id !== lockedId && game.isChapterOpen(chapter) };
  return <ChapterMapPage game={shown} onOpenMap={() => undefined} />;
}

function renderWith(state: GameState = SEEN, lockedId?: string) {
  localStorage.setItem("sugoroku-home-v2", JSON.stringify(state));
  return render(<GradeProvider><Harness lockedId={lockedId} /></GradeProvider>);
}

const cards = () => within(screen.getByRole("list", { name: plainText(COPY.CP_246) })).getAllByRole("button");
const title = (id: string) => (CHAPTERS.find((chapter) => chapter.id === id) as (typeof CHAPTERS)[number]).title;

beforeEach(() => {
  localStorage.clear();
  saveGrade5ForTest();
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("章の地図", () => {
  it("13章が道の順に並ぶ", () => {
    renderWith();
    expect(cards()).toHaveLength(CHAPTERS.length);
    expect(cards().map((card) => card.getAttribute("data-chapter-card"))).toEqual(CHAPTERS.map((chapter) => chapter.id));
  });

  it("今の章に aria-current と進みが付き、開いた時に focus が置かれる", () => {
    renderWith();
    const now = screen.getByRole("button", { name: plainText(COPY.CP_281(title("fraction"), COPY.CP_257)) });
    expect(now.getAttribute("aria-current")).toBe("page");
    expect(within(now).getByText(plainText(COPY.CP_214(3, 9)))).toBeTruthy();
    expect(document.activeElement).toBe(now);
    expect(cards().filter((card) => card.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("クリア済みの名前は CP_282、鍵の名前は CP_207", () => {
    renderWith(SEEN, "area");
    expect(screen.getByRole("button", { name: plainText(COPY.CP_282(title("decimal"), COPY.CP_257)) })).toBeTruthy();
    const locked = screen.getByRole("button", { name: plainText(COPY.CP_207(title("area"))) });
    expect(locked.hasAttribute("disabled")).toBe(true);
  });

  it("鍵の章を押しても章を開かない", () => {
    renderWith(SEEN, "area");
    const locked = screen.getByRole("button", { name: plainText(COPY.CP_207(title("area"))) });
    fireEvent.click(locked);
    expect(window.location.pathname).toBe("/");
  });

  it("開いている札を押すと、動きを減らす設定ではすぐ /sansu/{id} へ移る", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {},
    }));
    renderWith();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_282(title("integer"), COPY.CP_257)) }));
    expect(window.location.pathname).toBe("/sansu/integer");
  });

  it("動きがある時は紙を広げてから章を開く（MOT-023）", () => {
    vi.useFakeTimers();
    renderWith();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_282(title("integer"), COPY.CP_257)) }));
    expect(window.location.pathname).toBe("/");
    expect(document.querySelector(".cm-paper")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(window.location.pathname).toBe("/sansu/integer");
  });

  it("分野の見本が4つ並ぶ", () => {
    renderWith();
    const names = [plainText(COPY.CP_257), plainText(COPY.CP_258), plainText(COPY.CP_259), plainText(COPY.CP_260)];
    const items = document.querySelectorAll(".cm-legend li");
    expect([...items].map((item) => item.textContent)).toEqual(names);
  });

  it("見出しと上の帯のボタンが出る", () => {
    renderWith();
    expect(screen.getByRole("heading", { level: 1, name: plainText(COPY.CP_280) })).toBeTruthy();
    expect(screen.getByRole("button", { name: plainText(COPY.CP_215) })).toBeTruthy();
  });

  // 顔のボタンと音のボタン、アカウントのパネルは右上の CMP-043 としてアプリに1組だけ置く（D-245）。
  // 開く・閉じる動きの試験は App の試験へ移す
  it("音のボタンも顔のボタンもアカウントのパネルも、この画面には無い（D-245）", () => {
    renderWith();
    expect(screen.queryByRole("button", { name: plainText(COPY.CP_793) })).toBeNull();
    expect(screen.queryByRole("dialog", { name: plainText(COPY.CP_794) })).toBeNull();
    expect(document.querySelector(".cm-bar .sound-button, .cm-bar .sound-control, .cm-face")).toBeNull();
    expect(screen.queryByRole("button", { name: "ロッカー" })).toBeNull();
  });
});

describe("学年で章の数が変わる（FR-002、R-18）", () => {
  it("4年の算数は16章あり、道の順に並んでゴールまで出る", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 4 }));
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(SEEN));
    render(<GradeProvider><Harness /></GradeProvider>);
    const chapters = chaptersOf(4, "sansu");
    expect(chapters).toHaveLength(16);
    expect(cards().map((card) => card.getAttribute("data-chapter-card"))).toEqual(chapters.map((chapter) => chapter.id));
    expect([...document.querySelectorAll(".cm-card__badge")].map((badge) => badge.textContent)).toEqual(chapters.map((_, index) => String(index + 1)));
    // スタートとゴールを含めて18の置き場所。どの置き場所も行の中に収まる
    const spots = Array.from({ length: chapters.length + 2 }, (_, index) => roadSpot(index, 4));
    expect(spots.every((spot) => spot.row < roadRows(chapters.length + 2, 4) && spot.fx >= 0 && spot.fx <= 1)).toBe(true);
    expect(roadRows(chapters.length + 2, 4)).toBe(5);
    expect(document.querySelector<HTMLElement>(".cm-map")?.style.getPropertyValue("--rows")).toBe("5");
    expect(screen.getByText(plainText(COPY.CP_283))).toBeTruthy();
    expect(screen.getByText(plainText(COPY.CP_285))).toBeTruthy();
  });

  it("問題のある章が無い学年は、どの章も鍵になる（D-133。PG-004 は退避中だが isChapterOpen を共有する）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 4 }));
    localStorage.setItem("sugoroku-home-v2", JSON.stringify(SEEN));
    render(<GradeProvider><Harness /></GradeProvider>);
    expect(cards().every((card) => card.hasAttribute("disabled"))).toBe(true);
  });
});

describe("道の置き場所", () => {
  it("スタートは左端、行ごとに左右が入れ替わり、2行目からは半分ずれる", () => {
    expect(roadSpot(0, 4)).toEqual({ row: 0, fx: 0 });
    expect([0, 1, 2, 3].map((i) => roadSpot(i, 4).fx)).toEqual([0, 0.25, 0.5, 0.75]);
    expect([4, 5, 6, 7].map((i) => roadSpot(i, 4).fx)).toEqual([0.875, 0.625, 0.375, 0.125]);
    expect(roadSpot(8, 4)).toEqual({ row: 2, fx: 0.125 });
  });

  it("1行1章ではまん中に置き、行の数は置き場所の数と同じ", () => {
    expect(roadSpot(0, 1)).toEqual({ row: 0, fx: 0 });
    expect(roadSpot(1, 1)).toEqual({ row: 1, fx: 0.5 });
    expect(roadSpot(2, 1)).toEqual({ row: 2, fx: 0.5 });
    expect(roadRows(15, 1)).toBe(15);
    expect(roadRows(15, 4)).toBe(4);
    expect(roadRows(15, 2)).toBe(8);
  });
});

describe("スタートとゴール、番号の丸", () => {
  it("スタートとゴールの札が出て、押せない", () => {
    renderWith();
    expect(screen.getByText(plainText(COPY.CP_283))).toBeTruthy();
    expect(screen.getByText(plainText(COPY.CP_285))).toBeTruthy();
    expect(cards()).toHaveLength(CHAPTERS.length);
  });

  it("番号の丸は 1 から順に付き、読み上げない", () => {
    renderWith();
    const badges = [...document.querySelectorAll(".cm-card__badge")];
    expect(badges.map((badge) => badge.textContent)).toEqual(CHAPTERS.map((_, index) => String(index + 1)));
    expect(badges.every((badge) => badge.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
