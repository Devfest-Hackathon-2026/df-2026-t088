import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { REWARD } from "../../data";
import { MIDWAY_STATE } from "../../game/test-state";
import { LOGIN_KEY } from "../../login";
import { saveGrade5ForTest } from "../../test-grade";
import type { GameState } from "../../data";
import { chaptersOf } from "../../data";
import type { Game } from "../../game/use-game";
import { TileLessonPage } from "./TileLessonPage";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../../audio/use-bgm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../audio/use-bgm")>()),
  playSe: (kind: string) => played.push(kind),
}));

const STORAGE_KEY = "sugoroku-home-v2";

// 見本の進みのまま、PG-001 だけを通った状態
const openState = (sides: string[] = [], done = 3): GameState => ({
  ...MIDWAY_STATE,
  sansuSelected: true,
  introSeen: true,
  progress: { ...MIDWAY_STATE.progress, fraction: { done, sides, test: false } },
});

const savedState = (): GameState => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as GameState;

function renderBoard(state: GameState) {
  localStorage.setItem(LOGIN_KEY, "Google");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.history.replaceState(null, "", "/sansu/fraction");
  return render(<App />);
}

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

// 盤面が開いた時のスクロールは学習の動きではないので、数えない
function openLesson() {
  press(/タイルでたし算。/);
  press("学習をはじめる");
  scrollIntoView.mockClear();
}

function answer(text: string) {
  fireEvent.change(screen.getByLabelText(/^こたえ/), { target: { value: text } });
  press("こたえる");
}

/** 今のマスの学習を開く */
function openNow(done: number) {
  renderBoard(openState([], done));
  press(/。今ここ$/);
  scrollIntoView.mockClear();
}

const ruler = () => screen.getByRole("group", { name: "ものさし" });
const rulerTile = (name: string) => within(ruler()).getByRole("button", { name: new RegExp(`^[0-9]+/[0-9]+、${name}のタイル`) });
const trayTile = (name: string) => screen.getByRole("button", { name: new RegExp(`^[0-9]+/[0-9]+、${name}のタイル。のこり`) });

function place(name: string) {
  fireEvent.click(trayTile(name));
  press("ものさしに置く");
}

/** 押す操作だけで、たし算のタイルを解く。counts は左右のタイルに重ねるまい数 */
function solveAddition(left: string, right: string, unit: string, [leftCount, rightCount]: [number, number]) {
  place(left);
  place(right);
  if (unit !== right) fireEvent.click(trayTile(unit));
  for (let count = 0; count < leftCount; count += 1) fireEvent.click(rulerTile(left));
  for (let count = 0; count < rightCount; count += 1) fireEvent.click(rulerTile(right));
}

/** 押す操作だけで 1/2 + 1/3 を解く */
function solveFirstProblem() {
  solveAddition("2分の1", "3分の1", "6分の1", [3, 2]);
}

function fillSlots(...values: string[]) {
  const slots = screen.getAllByLabelText(/分のいくつ$/);
  values.forEach((value, index) => fireEvent.change(slots[index] as HTMLElement, { target: { value } }));
}

/** 解けたタイルから式にもどり、数えた □ を確かめてから答える */
function answerFromTiles(slots: string[], text: string) {
  press("もとの問題にもどる");
  fillSlots(...slots);
  press("こたえる");
  answer(text);
}

function answerAllProblems() {
  solveFirstProblem();
  answerFromTiles(["3", "2"], "5/6");
  press("つぎの問題へ");
  solveAddition("2分の1", "4分の3", "4分の1", [2, 3]);
  answerFromTiles(["2", "3"], "5/4");
  press("つぎの問題へ");
  solveAddition("3分の1", "6分の1", "6分の1", [2, 0]);
  answerFromTiles(["2", "1"], "1/2");
  press("つぎの問題へ");
  answer("7/12");
  press("つぎの問題へ");
  solveAddition("4分の1", "6分の1", "12分の1", [3, 2]);
  answerFromTiles(["3", "2"], "5/12");
}

const scrollIntoView = vi.fn();

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

beforeEach(() => {
  localStorage.clear();
  saveGrade5ForTest();
  played.length = 0;
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("盤面からの入口", () => {
  it("「学習をはじめる」で学習が開き、最初の問題は 1/2 + 1/3", () => {
    renderBoard(openState());
    openLesson();
    expect(window.location.pathname).toBe("/sansu/lesson/fraction-t2");
    expect(screen.getByRole("heading", { level: 1, name: "タイルでたし算" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "2分の1 たす 3分の1 は いくつ" })).toBeTruthy();
    expect(screen.getByText("1 / 5 問")).toBeTruthy();
  });

  it("タイルで解く学習は、はじめからタイルが開き、答えの欄はまだ出ない", () => {
    renderBoard(openState());
    openLesson();
    expect(screen.getByRole("group", { name: "ものさし" })).toBeTruthy();
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    expect(screen.queryByRole("button", { name: "分かんない" })).toBeNull();
  });

  it("今のマスを「学習をはじめる」と、そのマスの学習が開く", () => {
    openNow(3);
    expect(window.location.pathname).toBe("/sansu/lesson/main-3");
    expect(screen.getByRole("heading", { level: 1, name: "約分" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "6分の4" })).toBeTruthy();
  });

  it("図解のあるマスは、1問目の前に図解を見せ、「おわる」で同じマスの問題へ進む。進みは変えない", () => {
    openNow(0);
    expect(screen.getByText(/3 Lのジュース/)).toBeTruthy();
    press("つぎへ");
    press("つぎへ");
    press("おわる");
    expect(window.location.pathname).toBe("/sansu/lesson/main-0");
    expect(screen.getByText("1 / 5 問")).toBeTruthy();
    expect(savedState().progress.fraction?.done).toBe(0);
  });

  it("図解のあるマスを途中から続ける時は、図解を出さずに問題から", () => {
    openNow(0);
    press("つぎへ");
    press("つぎへ");
    press("おわる");
    answer("3/4");
    press("つぎの問題へ");
    vi.useFakeTimers();
    press("ばんめんにもどる");
    act(() => { vi.advanceTimersByTime(2100); });
    press(/。今ここ$/);
    expect(screen.queryByText(/3 Lのジュース/)).toBeNull();
    expect(screen.getByText("2 / 5 問")).toBeTruthy();
  });

  it("章のテストのマスも開く", () => {
    renderBoard(openState([], 9));
    press("章のテストをうける");
    expect(window.location.pathname).toBe("/sansu/lesson/test");
    expect(screen.getByRole("heading", { level: 1, name: "分数 のテスト" })).toBeTruthy();
  });

  it("学習の途中で盤面へ戻って開き直すと、同じ問題から続く", () => {
    openNow(6);
    answer("7/12");
    press("つぎの問題へ");
    expect(screen.getByText("2 / 5 問")).toBeTruthy();
    vi.useFakeTimers();
    press("ばんめんにもどる");
    act(() => { vi.advanceTimersByTime(2100); });
    press(/。今ここ$/);
    expect(screen.getByText("2 / 5 問")).toBeTruthy();
    expect(screen.getByRole("img", { name: "6分の1 たす 2分の1 は いくつ" })).toBeTruthy();
  });

  it("途中で盤面へ戻っても、進みも経験値も変えない", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    answerFromTiles(["3", "2"], "5/6");
    vi.useFakeTimers();
    press("ばんめんにもどる");
    act(() => { vi.advanceTimersByTime(2100); });
    expect(window.location.pathname).toBe("/sansu/fraction");
    expect(screen.getByRole("region", { name: "すごろくのばんめん" })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(openState()));
  });

  it("鍵の寄り道の学習へ履歴から来ると、盤面へ送る", () => {
    const locked: GameState = { ...openState(), progress: { ...MIDWAY_STATE.progress, fraction: { done: 2, sides: [], test: false } } };
    renderBoard(locked);
    act(() => {
      window.history.pushState(null, "", "/sansu/lesson/fraction-t2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(window.location.pathname).toBe("/sansu/fraction");
    expect(screen.getByRole("region", { name: "すごろくのばんめん" })).toBeTruthy();
  });

  it("保存の章が表示中の章とずれていても、表示中の章の盤面へ戻る", () => {
    // 学年を変えた直後など、保存の章（state.chapterId）が今の学年に無く、表示中の章（chapter）と食い違う時
    const chapter = chaptersOf(5, "sansu").find((candidate) => candidate.id === "fraction");
    const game = {
      state: { ...openState([], 3), chapterId: "integer" },
      chapter,
      chapterProgress: { done: 3, sides: [], test: false },
      wornGear: [],
      completeLesson: vi.fn(async () => {}),
    } as unknown as Game;
    window.history.replaceState(null, "", "/sansu/lesson/main-3");
    render(<TileLessonPage game={game} lessonKey="main-3" />);
    vi.useFakeTimers();
    fireEvent.click(document.querySelector(".lesson-exit") as HTMLElement);
    act(() => { vi.advanceTimersByTime(2100); });
    expect(window.location.pathname).toBe("/sansu/fraction");
  });

  it.each(["main-2", "main-5", "test", "nothing"])("今始められない学習 %s へ履歴から来ると、盤面へ送る", (key) => {
    renderBoard(openState());
    act(() => {
      window.history.pushState(null, "", `/sansu/lesson/${key}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(window.location.pathname).toBe("/sansu/fraction");
  });
});

describe("タイルで考える", () => {
  it("分かんないを押すとタイルが開き、ヒントは順に出て、なくなると文で伝える", () => {
    openNow(6);
    expect(screen.queryByRole("group", { name: "ものさし" })).toBeNull();
    press("分かんない");
    expect(screen.getByRole("group", { name: "ものさし" })).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("list", { name: "ヒント" })).toBeNull();
    press("次のヒント");
    expect(within(screen.getByRole("list", { name: "ヒント" })).getAllByRole("listitem").map((item) => item.textContent))
      .toEqual(["どちらも同じ大きさのタイルでうめられるか、ためしてみましょう"]);
    press("次のヒント");
    press("次のヒント");
    expect(within(screen.getByRole("list", { name: "ヒント" })).getAllByRole("listitem")).toHaveLength(3);
    press("次のヒント");
    expect(screen.getByText("ヒントはここまでです")).toBeTruthy();
  });

  it("分かんないを押すと、消えたボタンの代わりにタイルの中へフォーカスが移る", () => {
    openNow(6);
    press("分かんない");
    expect(document.activeElement?.tagName).toBe("BUTTON");
    expect(screen.getByRole("group", { name: "ものさし" }).closest("section")?.contains(document.activeElement)).toBe(true);
  });

  it("同じまちがいを続けても、文を置き直して気付けるようにする", () => {
    openNow(6);
    answer("2/5");
    const first = screen.getByText(/^ちがうみたいです/);
    answer("2/5");
    expect(first.isConnected).toBe(false);
    expect(screen.getByText(/^ちがうみたいです/)).toBeTruthy();
  });

  it("まちがえると、「分かんない」でタイルへ誘う", () => {
    openNow(6);
    answer("2/7");
    expect(screen.getByText("ちがうみたいです。「分かんない」をおして、タイルで考えてみましょう")).toBeTruthy();
  });

  it("盤に置いたのに解けていない間は答えの欄を出さず、空にすると答えられる（#377）", () => {
    openNow(6);
    press("分かんない");
    expect(screen.getByLabelText(/^こたえ/)).toBeTruthy();
    place("3分の1");
    place("4分の1");
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    expect(screen.queryByRole("button", { name: "こたえる" })).toBeNull();
    press("ぜんぶもどす");
    answer("7/12");
    expect(screen.getByText("せいかいです")).toBeTruthy();
  });

  it("式で考える類題は、ヒントの後に同じ問題をタイルで考えられて、行き止まりにならない", () => {
    renderBoard(openState());
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "fraction-t2": 3 }));
    openLesson();
    expect(screen.getByRole("img", { name: "4分の1 たす 3分の1 は いくつ" })).toBeTruthy();
    press("分かんない");
    expect(screen.queryByRole("group", { name: "ものさし" })).toBeNull();
    expect(screen.getByRole("list", { name: "ヒント" })).toBeTruthy();
    press("分かんない");
    expect(screen.getByText(/もう一度「分かんない」をおすと、タイルで考えられます/)).toBeTruthy();
    press("分かんない");
    expect(screen.getByRole("group", { name: "ものさし" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "4分の1 たす 3分の1 は いくつ" })).toBeTruthy();
    solveAddition("4分の1", "3分の1", "12分の1", [3, 4]);
    answerFromTiles(["3", "4"], "7/12");
    expect(screen.getByRole("img", { name: "4分の1 たす 3分の1 は 12分の3 たす 12分の4 は 12分の7" })).toBeTruthy();
  });

  it("ものさしの空いた所を押すと、選んだタイルが置ける", () => {
    renderBoard(openState());
    openLesson();
    fireEvent.click(trayTile("2分の1"));
    fireEvent.click(ruler());
    expect(rulerTile("2分の1")).toBeTruthy();
  });

  it("うめるタイルを先に押すと、端に置かず、先に置くタイルを文で伝える", () => {
    renderBoard(openState());
    openLesson();
    place("6分の1");
    expect(within(ruler()).queryByRole("button")).toBeNull();
    expect(screen.getByRole("group", { name: "タイル置き場" })).toBeTruthy();
    expect(document.querySelector(".lesson-notice")?.textContent).toContain("先に");
  });

  it("空きのあるタイルがあると、ボタンは「タイルに重ねる」になり、押すと上に重なる", () => {
    renderBoard(openState());
    openLesson();
    place("2分の1");
    place("3分の1");
    fireEvent.click(trayTile("6分の1"));
    expect(screen.queryByRole("button", { name: "ものさしに置く" })).toBeNull();
    for (let count = 0; count < 5; count += 1) press("タイルに重ねる");
    expect(within(ruler()).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "もとの問題にもどる" })).toBeTruthy();
  });

  it("ものさしのタイルは、押すと1段ずつ戻り、最後は外れる", () => {
    renderBoard(openState());
    openLesson();
    place("2分の1");
    fireEvent.click(rulerTile("2分の1"));
    expect(within(ruler()).queryByRole("button")).toBeNull();
    expect(trayTile("2分の1").getAttribute("aria-label")).toBe("1/2、2分の1のタイル。のこり 1");
  });

  it("重ねても、下のタイルの名前は見えたまま残る", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    expect([...document.querySelectorAll(".lesson-tile-name")].map((name) => name.textContent)).toEqual(["1/2", "1/3"]);
  });

  it("解けても枚数は先に言わず、式の □ は本人が入れる", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    expect(screen.queryByText(/まいぶん/)).toBeNull();
    press("もとの問題にもどる");
    expect(screen.queryByRole("img", { name: /6分の3/ })).toBeNull();
    expect(screen.queryByText(/まいぶん/)).toBeNull();
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    press("こたえる");
    expect(screen.getByText("□ に数を入れてください")).toBeTruthy();
    fillSlots("3", "3");
    press("こたえる");
    expect(screen.getAllByText("タイルのまい数を数えて、□ に入れましょう").length).toBeGreaterThan(0);
    fillSlots("3", "2");
    press("こたえる");
    expect(screen.getByText("□ はあっています。計算して、こたえを入れましょう")).toBeTruthy();
    expect(screen.queryByLabelText(/分のいくつ$/)).toBeNull();
    expect(screen.getByRole("img", { name: "2分の1 たす 3分の1 は 6分の3 たす 6分の2 は いくつ" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/^こたえ/));
    answer("5/6");
    expect(screen.getByRole("img", { name: "2分の1 たす 3分の1 は 6分の3 たす 6分の2 は 6分の5" })).toBeTruthy();
    expect(screen.getByText(/が 5 まいぶん/)).toBeTruthy();
    expect(screen.queryByText("タイルを数えて、□ に入れましょう")).toBeNull();
  });

  it("前の誤答が欄に残っていても、□ が正しければ誤答で止めず、空の欄で続きを聞く", () => {
    openNow(6);
    answer("2/7");
    press("分かんない");
    solveAddition("3分の1", "4分の1", "12分の1", [4, 3]);
    press("もとの問題にもどる");
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    fillSlots("4", "3");
    press("こたえる");
    expect(screen.getByText("□ はあっています。計算して、こたえを入れましょう")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(/^こたえ/).value).toBe("");
    answer("7/12");
    expect(screen.getByText("せいかいです")).toBeTruthy();
  });

  it("タイルを開いたら、式が見える所へスクロールする", () => {
    openNow(6);
    press("分かんない");
    expect(scrollIntoView.mock.contexts[0]).toBe(document.querySelector(".lesson-card"));
    expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({ block: "start" });
  });

  it("解けたら完成の所へスクロールし、並べ替えてももう一度はスクロールしない", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    expect(screen.getByText("ぴったりそろいました。式にもどしてみましょう")).toBeTruthy();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.querySelector(".lesson-back-row"));
    // 主ボタンは1画面に1つ
    expect(document.querySelectorAll(".button--primary")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "もとの問題にもどる" }).className).toContain("button--primary");
  });

  it("まちがえたらタイルへ戻れて、式にもどった間もものさしが見えている", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    press("もとの問題にもどる");
    expect(screen.getByRole("group", { name: "ものさし" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "タイル置き場" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /^1\/2、2分の1のタイル/ }).disabled).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("2分の1 は 6分のいくつ"));
    fillSlots("3", "2");
    press("こたえる");

    answer("2/5");
    expect(screen.getByText("ちがうみたいです。タイルにもどって、見なおしてみましょう")).toBeTruthy();
    press("タイルにもどる");
    expect(screen.getByRole("group", { name: "タイル置き場" })).toBeTruthy();
    const back = screen.getByRole("button", { name: "もとの問題にもどる" });
    expect(document.activeElement).toBe(back);

    fireEvent.click(back);
    expect(screen.getByLabelText<HTMLInputElement>(/^こたえ/).value).toBe("2/5");
    answer("5/6");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "タイルにもどる" })).toBeNull();
    expect(screen.getByRole("group", { name: "ものさし" })).toBeTruthy();
  });

  it("キーボードの Delete で、ものさしのタイルを外せる", () => {
    renderBoard(openState());
    openLesson();
    press(/^1\/2、2分の1のタイル。のこり/);
    press("ものさしに置く");
    const ruler = screen.getByRole("group", { name: "ものさし" });
    fireEvent.keyDown(within(ruler).getByRole("button"), { key: "Delete" });
    expect(within(ruler).queryByRole("button")).toBeNull();
  });

  it("最後の1枚を置いて「ものさしに置く」が消えても、フォーカスはものさしのタイルへ移る", () => {
    renderBoard(openState());
    openLesson();
    press(/^1\/2、2分の1のタイル。のこり/);
    const placeButton = screen.getByRole("button", { name: "ものさしに置く" });
    placeButton.focus();
    fireEvent.click(placeButton);
    expect(screen.queryByRole("button", { name: "ものさしに置く" })).toBeNull();
    const ruler = screen.getByRole("group", { name: "ものさし" });
    expect(document.activeElement).toBe(within(ruler).getByRole("button"));
  });

  it("Delete でタイルを外しても、フォーカスは置き場のタイルへ移る", () => {
    renderBoard(openState());
    openLesson();
    press(/^1\/2、2分の1のタイル。のこり/);
    press("ものさしに置く");
    const ruler = screen.getByRole("group", { name: "ものさし" });
    const placed = within(ruler).getByRole("button");
    placed.focus();
    fireEvent.keyDown(placed, { key: "Delete" });
    const tray = screen.getByRole("group", { name: "タイル置き場" });
    expect(tray.contains(document.activeElement)).toBe(true);
  });
});

describe("ドラッグ", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });

  function setup() {
    renderBoard(openState());
    openLesson();
    const ruler = screen.getByRole("group", { name: "ものさし" });
    vi.spyOn(ruler, "getBoundingClientRect").mockReturnValue(rect(0, 100, 600, 60));
    document.elementFromPoint = vi.fn(() => ruler);
    return ruler;
  }

  function dragTo(source: HTMLElement, x: number, y: number) {
    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 300 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: x, clientY: y });
    expect(document.querySelector(".lesson-ghost")).not.toBeNull();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: x, clientY: y });
    expect(document.querySelector(".lesson-ghost")).toBeNull();
  }

  it("置き場からものさしへ置け、外へ出すと戻る", () => {
    const ruler = setup();
    dragTo(screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ }), 100, 120);
    const placed = within(ruler).getByRole("button", { name: "1/2、2分の1のタイル" });
    expect(screen.getByRole("button", { name: "1/2、2分の1のタイル。のこり 0" })).toBeTruthy();
    dragTo(placed, 100, 500);
    expect(within(ruler).queryByRole("button")).toBeNull();
  });

  it("タッチは指を離した時点で押した操作になり、あとから click が来ても二重にならない", () => {
    setup();
    const tile = screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, pointerType: "touch", clientX: 10, clientY: 300 });
    fireEvent.pointerUp(window, { pointerId: 1, pointerType: "touch", clientX: 10, clientY: 300 });
    expect(tile.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(tile, { detail: 1 });
    expect(tile.getAttribute("aria-pressed")).toBe("true");
  });

  it("少ししか動かない押し方はドラッグにしない", () => {
    const ruler = setup();
    const tile = screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 10, clientY: 300 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: 301 });
    expect(document.querySelector(".lesson-ghost")).toBeNull();
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 12, clientY: 301 });
    expect(within(ruler).queryByRole("button")).toBeNull();
  });

  it("途中で取り消されたドラッグは何も変えない", () => {
    const ruler = setup();
    const tile = screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ });
    fireEvent.pointerDown(tile, { pointerId: 1, button: 0, clientX: 10, clientY: 300 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerCancel(window, { pointerId: 1, clientX: 100, clientY: 120 });
    expect(document.querySelector(".lesson-ghost")).toBeNull();
    expect(within(ruler).queryByRole("button")).toBeNull();
  });

  it("ドラッグの直後の click は、押した操作にしない", () => {
    setup();
    const tile = screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ });
    dragTo(tile, 100, 120);
    fireEvent.click(screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ }), { detail: 1 });
    expect(screen.queryByText("このタイルは、もうありません")).toBeNull();
  });

  it("タッチのドラッグの後は click が来なくても、次の1回の押す操作を飲み込まない", () => {
    setup();
    dragTo(screen.getByRole("button", { name: /^1\/2、2分の1のタイル。のこり/ }), 100, 120);
    // 使い切ったタイルは startDrag を呼ばない
    const usedUp = screen.getByRole("button", { name: "1/2、2分の1のタイル。のこり 0" });
    fireEvent.pointerDown(usedUp, { pointerId: 2, button: 0, clientX: 10, clientY: 300 });
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 10, clientY: 300 });
    fireEvent.click(usedUp, { detail: 1 });
    expect(screen.getByText("このタイルは、もうありません")).toBeTruthy();
  });
});

describe("問題の形", () => {
  it("約分は、約分しきるまで正解にしない", () => {
    openNow(3);
    answer("4/6");
    expect(screen.getByText("同じ大きさです。もっとかんたんにできます")).toBeTruthy();
    answer("2/3");
    expect(screen.getByText("せいかいです")).toBeTruthy();
  });

  it("約分はタイルでも解け、式にもどると □ は1つだけ出る", () => {
    openNow(3);
    press("分かんない");
    place("6分の4");
    fireEvent.click(trayTile("3分の1"));
    fireEvent.click(rulerTile("6分の4"));
    fireEvent.click(rulerTile("6分の4"));
    press("もとの問題にもどる");
    expect(document.querySelector(".lesson-equation-row")?.textContent).not.toContain("+");
    expect(screen.getAllByLabelText(/分のいくつ$/)).toHaveLength(1);
    // □ の分数がそのまま答えなので、下の欄に同じ答えを入れさせない
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    fireEvent.change(screen.getByLabelText("6分の4 は 3分のいくつ"), { target: { value: "2" } });
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.getByRole("img", { name: "6分の4 は 3分の2" })).toBeTruthy();
    expect(screen.getByText(/は同じ大きさです/)).toBeTruthy();
    expect(screen.getByText(/が 2 まいぶん/)).toBeTruthy();
  });

  it("通分は、2つの欄に入れて答える", () => {
    openNow(4);
    const [left, right] = screen.getAllByLabelText(/を分母をそろえた形で$/) as [HTMLElement, HTMLElement];
    fireEvent.change(left, { target: { value: "3/6" } });
    fireEvent.change(right, { target: { value: "2/6" } });
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
  });

  it("通分はタイルで解いても、足していないので まい数を出さない", () => {
    openNow(4);
    press("分かんない");
    solveAddition("2分の1", "3分の1", "6分の1", [3, 2]);
    press("もとの問題にもどる");
    const [left, right] = screen.getAllByLabelText(/を分母をそろえた形で$/) as [HTMLElement, HTMLElement];
    fireEvent.change(left, { target: { value: "3/6" } });
    fireEvent.change(right, { target: { value: "2/6" } });
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.queryByText(/まいぶん/)).toBeNull();
  });

  it("くらべる問題で式にもどると、入れる欄の話をせず、選ぶように伝える", () => {
    openNow(5);
    press("分かんない");
    solveAddition("2分の1", "5分の2", "10分の1", [5, 4]);
    press("もとの問題にもどる");
    expect(screen.queryByText(/こたえを入れてください/)).toBeNull();
    expect(screen.getByText(/どれかをえらびましょう/)).toBeTruthy();
  });

  it("見積もりは、答えを式と同じ帯分数で見せる", () => {
    renderBoard(openState([], 6));
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "main-6": 2 }));
    press(/。今ここ$/);
    press("1 より大きい");
    expect(screen.getByRole("img", { name: "4分の3 たす 2分の1 は 1と4分の1" })).toBeTruthy();
    expect(document.querySelector(".lesson-after")?.querySelector('[aria-label="1と4分の1"]')).not.toBeNull();
  });

  it("くらべる問題は、選んで答えると分母をそろえた形が出る", () => {
    openNow(5);
    press("5分の2 のほうが大きい");
    expect(screen.getByText(/「分かんない」をおして/)).toBeTruthy();
    press("2分の1 のほうが大きい");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.getByText(/分母をそろえると/)).toBeTruthy();
  });

  it("たし算は、正解すると式に答えが入り、約分の声かけが出る", () => {
    openNow(6);
    answer("7/12");
    expect(screen.getByRole("img", { name: "3分の1 たす 4分の1 は 12分の7" })).toBeTruthy();
    press("つぎの問題へ");
    answer("4/6");
    expect(screen.getByText(/すると/)).toBeTruthy();
  });

  it("帯分数の問題は、帯分数の形で見せ、答えの言い換えも出す", () => {
    openNow(8);
    expect(screen.getByRole("img", { name: "1と4分の1 たす 2分の1 は いくつ" })).toBeTruthy();
    answer("7/4");
    expect(screen.getByRole("img", { name: "1と4分の1 たす 2分の1 は 1と4分の3" })).toBeTruthy();
    expect(screen.getByText(/とも書けます/)).toBeTruthy();
  });
});

describe("フォーカスの移り先", () => {
  it("答えが合うと、消えた「こたえる」の代わりに「つぎの問題へ」へ移る", () => {
    openNow(6);
    answer("7/12");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "つぎの問題へ" }));
  });

  it("最後の問題に答えると、クリアのボタンへ移る", () => {
    openNow(6);
    answer("7/12");
    press("つぎの問題へ");
    answer("2/3");
    press("つぎの問題へ");
    press("1 より大きい");
    press("つぎの問題へ");
    answer("11/12");
    press("つぎの問題へ");
    answer("7/10");
    expect(screen.getByRole("heading", { level: 2, name: "やったね" })).toBeTruthy();
    expect(document.querySelector(".lesson-clear")?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });

  it("タイルから始める問題へ進むと、「通分の例を見る」ではなくタイルへ移る（Enter の連打で例が開かない）", () => {
    renderBoard(openState());
    openLesson();
    solveFirstProblem();
    answerFromTiles(["3", "2"], "5/6");
    press("つぎの問題へ");
    const example = screen.getByRole("button", { name: "通分の例を見る" });
    expect(document.activeElement).not.toBe(example);
    expect(document.activeElement?.closest(".lesson-tray, .lesson-ruler")).not.toBeNull();
  });

  it("選択肢の問題で「つぎの問題へ」を押すと、選択肢ではなく問題の見出しへ移る（続けた Enter が答えにならない）", () => {
    openNow(5);
    press("2分の1 のほうが大きい");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "つぎの問題へ" }));
    press("つぎの問題へ");
    const choices = screen.getAllByRole("button", { name: /のほうが大きい/ });
    expect(choices).not.toContain(document.activeElement);
    expect(document.activeElement).toBe(document.getElementById("lesson-problem-heading"));
  });
});

describe("クリア", () => {
  it("ぜんぶ解くと盤面へ戻り、いつもの流れで寄り道が終わって経験値が増える", async () => {
    renderBoard(openState());
    openLesson();
    vi.useFakeTimers();
    answerAllProblems();
    expect(screen.getByRole("heading", { level: 2, name: "やったね" })).toBeTruthy();
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(document.querySelector(".lesson-clear"));
    expect(screen.queryAllByRole("button", { name: "ばんめんにもどる" })).toHaveLength(1);
    expect(screen.queryByText(/もう一度クリアしました/)).toBeNull();

    press("ばんめんにもどる");
    await act(async () => { await vi.advanceTimersByTimeAsync(4500); });
    expect(window.location.pathname).toBe("/sansu/fraction");

    const sansuBefore = openState().xp.sansu;
    expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
    expect(savedState().xp.sansu).toBe(sansuBefore + REWARD.training);
    expect(screen.getByRole("button", { name: /タイルでたし算。終わった/ })).toBeTruthy();
  });

  it("2回目のクリアでは経験値が増えない", async () => {
    renderBoard(openState(["fraction-t2"]));
    openLesson();
    vi.useFakeTimers();
    answerAllProblems();
    expect(screen.getByText("もう一度クリアしました。けいけんちは1回目だけ増えます")).toBeTruthy();
    press("ばんめんにもどる");
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(savedState().xp).toEqual(openState().xp);
    expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
  });

  it("本線のマスをクリアすると、そのマスが終わって次のマスへ進む", async () => {
    openNow(3);
    vi.useFakeTimers();
    for (const text of ["2/3", "3/4", "2/3", "3/5"]) {
      answer(text);
      press("つぎの問題へ");
    }
    answer("3/4");
    press("ばんめんにもどる");
    await act(async () => { await vi.advanceTimersByTimeAsync(3300); });
    expect(savedState().progress.fraction?.done).toBe(4);
    expect(savedState().xp.sansu).toBe(openState().xp.sansu + REWARD.main);
    expect(localStorage.getItem("sugoroku-lesson-resume")).toBeNull();
    expect(screen.getByRole("button", { current: "step" }).getAttribute("aria-label")).toContain("通分");
  });
});

describe("紙の幕（MOT-032、D-251）", () => {
  it("「盤面にもどる」は幕が覆うまで学習のまま、覆った時に盤面へ移る。波は出さない", async () => {
    renderBoard(openState());
    openLesson();
    stubReducedMotion(false);
    vi.useFakeTimers();
    press("ばんめんにもどる");
    expect(document.querySelector(".back-fade")).not.toBeNull();
    expect(document.querySelector(".back-wave")).toBeNull();
    expect(window.location.pathname).toBe("/sansu/lesson/fraction-t2");
    // --duration-normal は 180ms。覆うのは 180ms、消えるのは 360ms
    await act(async () => { await vi.advanceTimersByTimeAsync(140); });
    expect(window.location.pathname).toBe("/sansu/lesson/fraction-t2");
    await act(async () => { await vi.advanceTimersByTimeAsync(80); });
    expect(window.location.pathname).toBe("/sansu/fraction");
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(document.querySelector(".back-fade")).toBeNull();
  });

  it("クリアして盤面へは、幕が消えてから歩き始める", async () => {
    renderBoard(openState());
    openLesson();
    answerAllProblems();
    stubReducedMotion(false);
    vi.useFakeTimers();
    press("ばんめんにもどる");
    await act(async () => { await vi.advanceTimersByTimeAsync(220); });
    expect(window.location.pathname).toBe("/sansu/fraction");
    expect(savedState().progress.fraction?.sides).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(savedState().progress.fraction?.sides).toEqual(["fraction-t2"]);
  });
});

describe("押した時の効果音（D-104）", () => {
  it("マスを押してカードに出すと選ぶ音、「学習をはじめる」で決定の音", () => {
    renderBoard(openState());
    press(/タイルでたし算。/);
    expect(played).toEqual(["select"]);
    press("学習をはじめる");
    expect(played).toEqual(["select", "enter"]);
  });

  it("今のマスを押して学習へ入ると決定の音", () => {
    openNow(6);
    expect(played).toEqual(["enter"]);
  });

  it("タイルを選ぶと選ぶ音、置けたら置いた音だけ、置けなかったら選ぶ音", () => {
    renderBoard(openState());
    openLesson();
    played.length = 0;
    // うめるタイルを先に置こうとしても置けない
    place("6分の1");
    expect(played).toEqual(["select", "select"]);
    played.length = 0;
    place("2分の1");
    expect(played).toEqual(["select", "place"]);
  });

  it("答えると結果の音だけ、空欄で結果の音が無い時は決定の音", () => {
    openNow(6);
    played.length = 0;
    answer("2/7");
    expect(played).toEqual(["wrong"]);
    played.length = 0;
    answer("");
    expect(played).toEqual(["enter"]);
    played.length = 0;
    answer("7/12");
    expect(played).toEqual(["correct"]);
    press("つぎの問題へ");
    expect(played).toEqual(["correct", "enter"]);
  });

  it("「ばんめんにもどる」は戻る音だけ", () => {
    openNow(6);
    played.length = 0;
    press("ばんめんにもどる");
    expect(played).toEqual(["back"]);
  });
});
