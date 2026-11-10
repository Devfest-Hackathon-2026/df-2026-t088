import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_KEY, loadAccount } from "./account";
import { App } from "./App";
import { chaptersOf } from "./data";
import type { GameState } from "./data";
import { KANJI_BY_GRADE } from "./data/kanji-grades";
import { MIDWAY_STATE } from "./game/test-state";
import { displayText } from "./ruby-text";
import { COPY } from "./copy";
import { LOGIN_KEY } from "./login";
import * as gradeOne from "./lesson/grade-one";
import * as upperMath from "./lesson/upper-math";

const SEEN: GameState = { ...MIDWAY_STATE, introSeen: true, sansuSelected: true };
const CJK = /[一-鿿]/g;

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

/** 画面の文字と、読み上げの名前（aria-label、title）を集める */
function shownTexts(): string[] {
  const texts = [document.body.textContent ?? ""];
  document.querySelectorAll("[aria-label], [title]").forEach((el) => {
    texts.push(el.getAttribute("aria-label") ?? "", el.getAttribute("title") ?? "");
  });
  return texts;
}

const outsideOf = (grade: 1 | 2 | 3 | 4 | 5 | 6, texts: string[]): string[] => {
  const allowed = new Set(Array.from({ length: grade }, (_unused, i) => KANJI_BY_GRADE[(i + 1) as 1 | 2 | 3 | 4 | 5 | 6]).join(""));
  return [...new Set(texts.join("").match(CJK) ?? [])].filter((ch) => !allowed.has(ch));
};

function openPage(grade: string | null, path: string) {
  localStorage.setItem(LOGIN_KEY, "Google");
  localStorage.setItem("sugoroku-home-v2", JSON.stringify(SEEN));
  if (grade !== null) localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: Number(grade) }));
  window.history.replaceState(null, "", path);
  return render(<App />);
}

// 算数の章えらびは、ほかの教科と同じ教科の島（D-130）
/** 開発中だけ右下に出るデバッグの学年（CMP-027）を開いて、学年を押す */
async function chooseDebugGrade(grade: number) {
  fireEvent.click(await screen.findByRole("button", { name: /切り.える/ }));
  fireEvent.click(screen.getByRole("radio", { name: `${grade}年生` }));
}

const cardCount = () => document.querySelectorAll(".subject-island__chapter").length;

describe("学年で漢字を出し分ける（D-91）", () => {
  it("学年1では、章をえらぶ画面の文字と読み上げの名前に 1年の字のほかの漢字が出ない。注記の記号も出ない", () => {
    openPage("1", "/sansu");
    expect(cardCount()).toBeGreaterThan(0);
    const texts = shownTexts();
    expect(outsideOf(1, texts)).toEqual([]);
    expect(texts.join("")).not.toMatch(/[[|\]]/);
  });

  it("学年1では、鍵の章札の読み上げの名前と、押した時の知らせにも 1年の字のほかの漢字が出ない（D-133）", () => {
    const first = chaptersOf(1, "sansu")[0]!;
    const hasGradeOne = gradeOne.hasGradeOne;
    vi.spyOn(gradeOne, "hasGradeOne").mockImplementation((id) => id !== first.id && hasGradeOne(id));
    openPage("1", "/sansu");
    const card = screen.getByRole("button", { name: displayText(COPY.CP_207(first.title), 1) });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(card);
    expect(screen.getByRole("status").textContent).toBe(displayText(COPY.CP_550(first.title), 1));
    expect(window.location.pathname).toBe("/sansu");
    const texts = shownTexts();
    expect(outsideOf(1, texts)).toEqual([]);
    expect(texts.join("")).not.toMatch(/[[|\]]/);
  });

  it("学年6でも、配当表に無い字（盤、記録の録 など）は出ない", () => {
    // 教材の追加に左右されず、教材未登録の章を押した時の表示を検証する。
    const first = chaptersOf(6, "sansu")[0]!;
    const hasUpperMath = upperMath.hasUpperMath;
    vi.spyOn(upperMath, "hasUpperMath").mockImplementation((id) => id !== first.id && hasUpperMath(id));
    openPage("6", "/sansu");
    expect(cardCount()).toBeGreaterThan(0);
    expect(outsideOf(6, shownTexts())).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_207(first.title), 6) }));
    expect(screen.getByRole("status").textContent).toBe(displayText(COPY.CP_550(first.title), 6));
    expect(outsideOf(6, shownTexts())).toEqual([]);
  });

  it("学年を替えると画面がその場で替わり、章の数はその学年の算数の章の数になる", async () => {
    openPage("1", "/sansu");
    expect(cardCount()).toBe(chaptersOf(1, "sansu").length);
    cleanup();
    // 学年は開発中だけのデバッグの学年で替える（D-144）。盤面に入れるのは問題のある5年の章なので、5年の分数から1年へ替える。替えると算数の章えらびへ移る（FR-002、D-133）
    openPage("5", "/sansu/fraction");
    await chooseDebugGrade(1);
    expect(loadAccount().grade).toBe(1);
    expect(cardCount()).toBe(chaptersOf(1, "sansu").length);
    expect(window.location.pathname).toBe("/sansu");
  });

  it("学年を替えると、今の教科の章えらびへ移る（FR-002）", async () => {
    // 5年の分数の盤面から3年にすると、3年の算数の章えらびへ
    openPage("5", "/sansu/fraction");
    expect(window.location.pathname).toBe("/sansu/fraction");
    await chooseDebugGrade(3);
    expect(window.location.pathname).toBe("/sansu");
    expect(cardCount()).toBe(chaptersOf(3, "sansu").length);
  });
});

describe("学年で出す教科が替わる（FR-002）", () => {
  it("1年にすると、実施されない理科の道 /rika は /home へ移る", () => {
    openPage("1", "/rika");
    expect(window.location.pathname).toBe("/home");
  });

  it("生活の島の道 /seikatsu は、1年でも3年でも出さない教科なので /home へ移る（FR-011）", () => {
    openPage("1", "/seikatsu");
    expect(window.location.pathname).toBe("/home");
    cleanup();
    openPage("3", "/seikatsu");
    expect(window.location.pathname).toBe("/home");
  });

  it("3年の理科の章は問題が無く鍵で、押しても盤面は出ない。章の道を直に開くと島へ戻る（D-133）", () => {
    openPage("3", "/rika");
    const first = chaptersOf(3, "rika")[0]!;
    fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_207(first.title), 3) }));
    expect(window.location.pathname).toBe("/rika");
    expect(screen.queryByRole("button", { name: "じぶんのきろく" })).toBeNull();
    cleanup();
    openPage("3", `/rika/${first.id}`);
    expect(window.location.pathname).toBe("/rika");
    expect(screen.queryByRole("button", { name: "じぶんのきろく" })).toBeNull();
  });
});
