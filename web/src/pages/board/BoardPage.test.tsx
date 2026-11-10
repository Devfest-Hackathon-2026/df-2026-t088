import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../copy";
import { plainText } from "../../ruby-text";
import { CHAPTERS } from "../../data";
import { MIDWAY_STATE } from "../../game/test-state";
import type { GameState } from "../../data";
import { useGame } from "../../game/use-game";
import { BoardPage } from "./BoardPage";
import { layoutOf, NARROW_MAX_COLS, roadShapesOf, segmentPathOf, sideLineOf } from "./Road";

// 5年の分数の教材を確かめる。Provider を使うと文字が5年の表示（漢字がかなに替わる）になるので、初めの学年だけ5年にする（開発中に5年を選んだ時。FR-012）
vi.mock("../../grade", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../grade")>()), DEFAULT_GRADE: 5 }));


// 問題の無いマスを作るため、分数の章の学習を一部だけ無いことにする。章としては開いたまま（D-133）。
// 実データでは、問題のある章のマスは全部に問題があるので、ここで差す
const missing = vi.hoisted(() => ({ keys: new Set<string>() }));
vi.mock("../../lesson/fraction-lessons", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lesson/fraction-lessons")>();
  return {
    ...original,
    findLesson: (chapterId: string, target: Parameters<typeof original.findLesson>[1]) =>
      chapterId === "fraction" && missing.keys.has(original.lessonKey(target)) ? undefined : original.findLesson(chapterId, target),
  };
});

const openChapters = vi.fn();

let latestGame: ReturnType<typeof useGame> | null = null;

function Harness() {
  const game = useGame();
  latestGame = game;
  return (
    <>
      <BoardPage game={game} onOpenChapters={openChapters} />
      <p data-testid="toast">{game.toast?.text}</p>
    </>
  );
}

// 最初の説明を出さない状態を既定にする。説明の試験だけ MIDWAY_STATE をそのまま使う
const SEEN: GameState = { ...MIDWAY_STATE, introSeen: true, sansuSelected: true };

function renderWith(state: GameState) {
  localStorage.setItem("sugoroku-home-v2", JSON.stringify(state));
  return render(<Harness />);
}

const withProgress = (chapterId: string, progress: GameState["progress"]): GameState =>
  ({ ...SEEN, chapterId, progress: { ...SEEN.progress, ...progress } });

const SUBJECT_NAME = "算数";
const fractionChapter = CHAPTERS.find((chapter) => chapter.id === "fraction");
const fractionCount = fractionChapter?.items.length ?? 0;
// マスの名前は子ども向けの短い言葉（D-152、#416）。データから引く
const firstCellName = plainText(fractionChapter?.items[0]?.title ?? "");
const road = () => screen.getByRole("region", { name: "すごろくの盤面" });
const roadNames = () => within(road()).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? "");
const cardHeading = () => within(screen.getByRole("complementary")).getByRole("heading", { level: 2 });
const spot = (name: RegExp) => {
  const node = within(road()).getByRole("button", { name }).closest<HTMLElement>(".node");
  return { col: node?.style.getPropertyValue("--col"), row: node?.style.getPropertyValue("--row") };
};
const card = () => within(screen.getByRole("complementary"));

beforeEach(() => {
  localStorage.clear();
  missing.keys.clear();
  openChapters.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("最初の説明", () => {
  it("最初の1回だけ開き、閉じると記録して次からは出さない", () => {
    const view = renderWith(MIDWAY_STATE);
    expect(screen.getByRole("dialog", { name: "分数の章の途中から始めます" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "やってみる" }));
    expect(screen.queryByRole("heading", { name: "分数の章の途中から始めます" })).toBeNull();
    const saved = JSON.parse(localStorage.getItem("sugoroku-home-v2") ?? "{}") as GameState;
    expect(saved.introSeen).toBe(true);
    view.unmount();
    render(<Harness />);
    expect(screen.queryByRole("heading", { name: "分数の章の途中から始めます" })).toBeNull();
  });
});

describe("上の帯", () => {
  it("h1 が章の名前で、進みを添える", () => {
    renderWith(SEEN);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.getAttribute("aria-label")).toBe("分数 3 / 9 マス");
    expect(heading.textContent).toContain("分数");
    expect(heading.textContent).toContain("3 / 9 マス");
  });

  it("「章をえらぶ」を押すと onOpenChapters が呼ばれる", () => {
    renderWith(SEEN);
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_266) }));
    expect(openChapters).toHaveBeenCalledTimes(1);
  });

  it("章の道と一覧の入口は無い", () => {
    renderWith(SEEN);
    expect(screen.queryByRole("navigation", { name: plainText(COPY.CP_246) })).toBeNull();
    expect(screen.queryByRole("button", { name: "ぜんぶの章" })).toBeNull();
  });
});

describe("ジグザグの盤面", () => {
  it("スタートの丸は無く、今ここに aria-current=step が付く", () => {
    renderWith(SEEN);
    expect(screen.queryByText("スタート")).toBeNull();
    const now = within(road()).getByRole("button", { current: "step" });
    expect(now.getAttribute("aria-label")).toBe("4マス目 約分。今ここ");
  });

  it("アバターは今のマスの行に立つ", () => {
    renderWith(SEEN);
    const anchor = road().querySelector("[data-walker-anchor]");
    expect(anchor).toBe(within(road()).getByRole("button", { current: "step" }));
  });

  it("全部のマスを終えると、章のテストの行に立つ", () => {
    renderWith(withProgress("fraction", { fraction: { done: fractionCount, sides: [], test: true } }));
    const anchor = road().querySelector("[data-walker-anchor]");
    expect(anchor?.getAttribute("aria-label")).toBe("章のテスト。終わった");
  });

  it("終えたマスも畳まず、全部のマスを並べる", () => {
    renderWith(SEEN);
    expect(roadNames().filter((name) => /^\dマス目/.test(name))).toHaveLength(fractionCount);
    expect(roadNames()).toContain(`1マス目 ${firstCellName}。終わった`);
  });

  it("寄り道は、分かれるマスの直後に並ぶ", () => {
    // 整数の章で 2 マス終えると特訓場が開く。after は分かれるマスの索引なので、after 2 は 3 マス目の直後
    renderWith(withProgress("integer", { integer: { done: 2, sides: [], test: false } }));
    const names = roadNames();
    const index = names.findIndex((name) => name.startsWith("特訓場"));
    expect(index).toBeGreaterThan(0);
    expect(names[index - 1]).toMatch(/^3マス目/);
  });

  it("まだ開いていない寄り道は出さない", () => {
    renderWith(SEEN);
    const names = roadNames();
    expect(names.some((name) => name.includes("約分と通分のかくにん"))).toBe(false);
    expect(names.some((name) => name.includes("答えを見積もる"))).toBe(false);
  });

  it("寄り道は「寄」だけを書き、名前は読み上げに持つ。終えた物は is-done", () => {
    renderWith(withProgress("fraction", { fraction: { done: 3, sides: ["fraction-t2"], test: false } }));
    const side = within(road()).getByRole("button", { name: /^特訓場/ });
    expect(side.textContent).toBe(plainText(COPY.CP_284));
    expect(side.getAttribute("aria-label")).toBe("特訓場 タイルでたし算。終わった");
    expect(side.classList.contains("is-done")).toBe(true);
  });

  it("マスには番号だけを書き、名前は見た目に出さず aria-label にある（D-99）", () => {
    renderWith(SEEN);
    const cell = within(road()).getByRole("button", { name: /^1マス目/ });
    expect(cell.textContent).toBe("1");
    expect(cell.getAttribute("aria-label")).toBe(`1マス目 ${firstCellName}。終わった`);
    expect(road().textContent).not.toContain("約分");
  });

  it("小数の章（見本のログインの最初の章）：7 マスの aria-label と今のマスのカードに、学習指導要領の文が出ない（#416）", () => {
    const decimal = CHAPTERS.find((chapter) => chapter.id === "decimal")!;
    renderWith({ ...SEEN, chapterId: "decimal", progress: { ...SEEN.progress, decimal: { done: 0, sides: [], test: false } } });
    const cells = roadNames().filter((name) => /^\dマス目/.test(name));
    expect(cells).toHaveLength(7);
    for (const name of cells) expect(name).not.toMatch(/身に付ける|次のような|及び|こと。|小数点の位置を移して/);
    expect(cells[0]).toBe(`1マス目 ${plainText(decimal.items[0]!.title)}。今ここ`);
    expect(plainText(decimal.items[0]!.title)).toBe("10倍・100倍と小数点");
    const text = screen.getByRole("complementary").textContent ?? "";
    expect(text).toContain("10倍・100倍と小数点");
    expect(text).not.toMatch(/身に付ける|次のような|小数点の位置を移して/);
  });

  it("Tab の順は道の順で、章のテストが最後", () => {
    renderWith(SEEN);
    const names = roadNames();
    const mains = names.map((name) => /^(\d+)マス目/.exec(name)?.[1]).filter(Boolean).map(Number);
    expect(mains).toEqual(Array.from({ length: fractionCount }, (_, i) => i + 1));
    expect(names.at(-1)).toBe("章のテスト。まだ");
  });

  it("位置は --col と --row で付け、本線と章のテストが道の順に1行4マスのS字に並ぶ", () => {
    renderWith(SEEN);
    // 1行目は左から右、2行目は右から左、3行目は左から右
    expect(spot(/^1マス目/)).toEqual({ col: "0", row: "0" });
    expect(spot(/^4マス目/)).toEqual({ col: "3", row: "0" });
    expect(spot(/^5マス目/)).toEqual({ col: "3", row: "1" });
    expect(spot(/^8マス目/)).toEqual({ col: "0", row: "1" });
    expect(spot(/^9マス目/)).toEqual({ col: "0", row: "2" });
    expect(spot(/^章のテスト/)).toEqual({ col: "1", row: "2" });
    const nodes = Array.from(road().querySelectorAll<HTMLElement>(".node"));
    expect(nodes).toHaveLength(fractionCount + 1);
    nodes.forEach((node, i) => {
      const row = Math.floor(i / 4);
      expect(node.style.getPropertyValue("--row")).toBe(String(row));
      expect(node.style.getPropertyValue("--col")).toBe(String(row % 2 === 1 ? 3 - (i % 4) : i % 4));
    });
  });

  it("行の端は半円でつなぐ。線の座標は枠と同じ縦横比の viewBox", () => {
    renderWith(SEEN);
    const svg = road().querySelector(".road-line");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 512 408");
    expect(road().querySelectorAll(".road-band")).toHaveLength(fractionCount);
    // 揺れを付ける前の形。1 → 2 マス目は横にまっすぐ、4 → 5 マス目は右へ膨らむ半円、8 → 9 マス目は左へ膨らむ半円
    const paths = roadShapesOf(fractionCount + 1).map(segmentPathOf);
    expect(paths).toHaveLength(fractionCount);
    expect(paths[0]).toBe("M112 68L208 68");
    expect(paths[3]).toBe("M400 68A68 68 0 0 1 400 204");
    expect(paths[7]).toBe("M112 204A68 68 0 0 0 112 340");
  });

  it("1行のマスの数は行ごとにそろえ、枠の大きさを列と行の数から決める（D-113）", () => {
    // 整数は5マスと章のテストで6つ。4 + 2 ではなく 3 + 3 に並べる
    renderWith(withProgress("integer", {}));
    const field = road().querySelector<HTMLElement>(".road-field");
    expect(field?.style.getPropertyValue("--rows")).toBe("2");
    expect(field?.style.getPropertyValue("--board-cols")).toBe("3");
    expect(field?.style.getPropertyValue("--board-box-w")).toBe("368");
    expect(field?.style.getPropertyValue("--board-box-h")).toBe("324");
    expect(spot(/^3マス目/)).toEqual({ col: "2", row: "0" });
    expect(spot(/^4マス目/)).toEqual({ col: "2", row: "1" });
    expect(spot(/^章のテスト/)).toEqual({ col: "0", row: "1" });
    expect(road().querySelector(".road-line")?.getAttribute("viewBox")).toBe("0 0 368 272");
  });

  it.each([
    [3, 1, 3], [4, 1, 4], [5, 2, 3], [6, 2, 3], [7, 2, 4], [8, 2, 4], [9, 3, 3], [10, 3, 4],
  ])("%i マスは %i 行 %i 列", (total, rows, cols) => {
    expect(layoutOf(total)).toMatchObject({ rows, cols });
  });

  it("768px 以上（matchMedia が合わない）は1行4マスのまま", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }));
    renderWith(SEEN);
    expect(spot(/^5マス目/)).toEqual({ col: "3", row: "1" });
    expect(spot(/^章のテスト/)).toEqual({ col: "1", row: "2" });
  });

  // 767px 以下は1行3マスまで。行の数 = ceil(マス数 / 3)、1行のマスの数 = ceil(マス数 / 行の数)（D-237）
  it.each([
    [3, 1, 3], [4, 2, 2], [5, 2, 3], [6, 2, 3], [7, 3, 3], [9, 3, 3], [10, 4, 3],
  ])("767px 以下は %i マスを %i 行 %i 列に並べる", (total, rows, cols) => {
    expect(layoutOf(total, NARROW_MAX_COLS)).toMatchObject({ rows, cols });
    expect(rows).toBe(Math.ceil(total / 3));
    expect(cols).toBe(Math.ceil(total / rows));
  });

  describe("767px 以下の盤面（matchMedia をモック）", () => {
    let narrow = true;
    let listeners: Array<() => void> = [];
    beforeEach(() => {
      narrow = true;
      listeners = [];
      vi.stubGlobal("matchMedia", (query: string) => ({
        get matches() { return query === "(max-width: 767px)" && narrow; },
        media: query,
        addEventListener: (_type: string, listener: () => void) => { listeners.push(listener); },
        removeEventListener: (_type: string, listener: () => void) => { listeners = listeners.filter((item) => item !== listener); },
      }));
    });

    it("最初の描画から1行3マスのS字（10マスは 3+3+3+1）。DOM の順は道の順のまま", () => {
      renderWith(SEEN);
      expect(spot(/^1マス目/)).toEqual({ col: "0", row: "0" });
      expect(spot(/^3マス目/)).toEqual({ col: "2", row: "0" });
      expect(spot(/^4マス目/)).toEqual({ col: "2", row: "1" });
      expect(spot(/^6マス目/)).toEqual({ col: "0", row: "1" });
      expect(spot(/^7マス目/)).toEqual({ col: "0", row: "2" });
      expect(spot(/^9マス目/)).toEqual({ col: "2", row: "2" });
      expect(spot(/^章のテスト/)).toEqual({ col: "2", row: "3" });
      const field = road().querySelector<HTMLElement>(".road-field");
      expect(field?.style.getPropertyValue("--rows")).toBe("4");
      expect(field?.style.getPropertyValue("--board-cols")).toBe("3");
      expect(roadNames()[0]).toMatch(/^1マス目/);
    });

    it("整数（6マス）は 3+3", () => {
      renderWith(withProgress("integer", {}));
      const field = road().querySelector<HTMLElement>(".road-field");
      expect(field?.style.getPropertyValue("--rows")).toBe("2");
      expect(field?.style.getPropertyValue("--board-cols")).toBe("3");
    });

    it("幅が変わったら並びが切り替わる", () => {
      renderWith(SEEN);
      expect(spot(/^4マス目/)).toEqual({ col: "2", row: "1" });
      narrow = false;
      act(() => listeners.forEach((listener) => listener()));
      expect(spot(/^4マス目/)).toEqual({ col: "3", row: "0" });
    });
  });

  it("寄り道は分かれる本線のマスに付く（4マス目）", () => {
    // 分数の after 3 は 4 マス目
    renderWith(withProgress("fraction", { fraction: { done: 3, sides: [], test: false } }));
    const node = within(road()).getByRole("button", { name: /^特訓場/ }).closest(".node");
    expect(node?.querySelector(".side")).not.toBeNull();
    expect(node?.contains(within(road()).getByRole("button", { name: /^4マス目/ }))).toBe(true);
    // 下りる点線は道の SVG に、本線と同じ揺れで描く。4 マス目（1行目の右端）の中心から、行の間隔の半分だけ真下へ（#185）
    const total = road().querySelectorAll(".road-band").length + 1;
    expect(sideLineOf(total, 3)).toEqual({ x: 400, y1: 68, y2: 136 });
    const lines = road().querySelectorAll(".road-side");
    expect(lines).toHaveLength(1);
    const [x1, y1, ...rest] = lines[0].getAttribute("d")?.match(/-?[\d.]+/g)?.map(Number) ?? [];
    const [x2, y2] = rest.slice(-2);
    expect(Math.abs(x1 - 400) + Math.abs(y1 - 68)).toBeLessThan(3);
    expect(Math.abs(x2 - 400) + Math.abs(y2 - 136)).toBeLessThan(3);
  });

  it("アバターは真上のマスに寄り道がある時だけ、盤面の内側へずれる", () => {
    const walker = () => road().querySelector(".walker");
    // 寄り道は 4 マス目（1 行目の右端）の真下。その下の 5 マス目に立つと、左へずれる
    const view = renderWith(withProgress("fraction", { fraction: { done: 4, sides: [], test: false } }));
    expect(walker()?.classList.contains("walker--shift-left")).toBe(true);
    view.unmount();
    // 4 マス目に立つ時は真上にマスが無いのでずれない
    renderWith(withProgress("fraction", { fraction: { done: 3, sides: [], test: false } }));
    expect(walker()?.className).not.toMatch(/walker--shift/);
  });

  it("真上のマスに寄り道が出ていなければ、アバターはずれない", () => {
    renderWith(withProgress("fraction", { fraction: { done: 1, sides: [], test: false } }));
    expect(road().querySelector(".walker")?.className).not.toMatch(/walker--shift/);
  });
});

describe("道の線", () => {
  it("すごろくの道は縁・砂色の帯・点線を重ね、行をまたぐ区間は半円で、通った区間だけ実線を重ねる（D-110、D-112）", () => {
    renderWith(withProgress("fraction", { fraction: { done: 5, sides: [], test: false } }));
    const band = Array.from(road().querySelectorAll(".road-band")).map((path) => path.getAttribute("d") ?? "");
    // 分数は9マスと章のテストで10。4 + 4 + 2 の3行なので、行をまたぐ半円（半径＝行の間隔の半分 68）が2つ
    expect(roadShapesOf(band.length + 1).map(segmentPathOf).filter((d) => d.includes("A68 68"))).toHaveLength(2);
    // 手描きの揺れは線の座標に付ける。前の区間の終わりと次の区間の始まりは同じ点で、つなぎ目に段差が無い（#185）
    const ends = band.map((d) => d.match(/-?[\d.]+/g)?.map(Number) ?? []);
    ends.slice(1).forEach((next, i) => expect(next.slice(0, 2)).toEqual(ends[i].slice(-2)));
    expect(road().querySelectorAll(".road-edge")).toHaveLength(band.length);
    expect(road().querySelectorAll(".road-dash")).toHaveLength(band.length);
    // 5つ目のマスまで終えている：5マス目へ入る線まで通った
    expect(road().querySelectorAll(".road-done")).toHaveLength(5);
  });
});

describe("マスを押す", () => {
  it("今のマスを押すと学習へ入る", () => {
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { current: "step" }));
    expect(window.location.pathname).toBe("/sansu/lesson/main-3");
  });

  it("ほかのマスを押すとカードが替わり、「今のマスにもどる」で戻る", () => {
    renderWith(SEEN);
    expect(cardHeading().textContent).toContain("約分");
    expect(card().queryByRole("button", { name: plainText(COPY.CP_261) })).toBeNull();
    fireEvent.click(within(road()).getByRole("button", { name: /^5マス目/ }));
    expect(window.location.pathname).toBe("/");
    expect(cardHeading().getAttribute("aria-label")).toBe("通分");
    expect(card().getByText(plainText(COPY.CP_227))).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_225) })).toBeNull();
    fireEvent.click(card().getByRole("button", { name: plainText(COPY.CP_261) }));
    expect(cardHeading().getAttribute("aria-label")).toBe("約分");
    expect(card().queryByRole("button", { name: plainText(COPY.CP_261) })).toBeNull();
  });

  it("終えたマスを選ぶと CP-226 を出し、ボタンは出さない", () => {
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { name: /^1マス目/ }));
    expect(card().getByText(plainText(COPY.CP_226))).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_225) })).toBeNull();
  });

  it("寄り道を押すと学習へは入らず、カードに寄り道を出す", () => {
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { name: /^特訓場/ }));
    expect(window.location.pathname).toBe("/");
    expect(card().getByText(plainText(COPY.CP_231))).toBeTruthy();
    fireEvent.click(card().getByRole("button", { name: plainText(COPY.CP_225) }));
    expect(window.location.pathname).toBe("/sansu/lesson/fraction-t2");
  });

  it("今のマスに問題が無ければ、CP-286 を出してボタンも CP-222 のトーストも出さない（D-117、D-133）", () => {
    // 一部のマスだけ問題が無い章は開いたまま。今のマス（4マス目）の問題を無いことにする
    missing.keys.add("main-3");
    renderWith(SEEN);
    expect(card().getByText(plainText(COPY.CP_286))).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_225) })).toBeNull();
    expect(screen.getByTestId("toast").textContent).toBe("");
    expect(window.location.pathname).toBe("/");
  });

  it("問題の無いマスは、まだのマスも CP-286 で、ボタンを出さない（D-133）", () => {
    missing.keys.add("main-4");
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { name: /^5マス目/ }));
    expect(card().getByText(plainText(COPY.CP_286))).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_225) })).toBeNull();
  });

  it("まだのマスは学ぶことと CP-227 だけで、出典と「仮」は出さない", () => {
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { name: /^9マス目/ }));
    expect(card().getByText(plainText(COPY.CP_227))).toBeTruthy();
    expect(screen.queryByText(/学習指導要領/)).toBeNull();
    expect(screen.queryByText("仮")).toBeNull();
  });

  it("章のテストを選ぶと、あと何マスかを出す", () => {
    renderWith(SEEN);
    fireEvent.click(within(road()).getByRole("button", { name: "章のテスト。まだ" }));
    expect(card().getByText("章のゴール")).toBeTruthy();
    expect(card().getByText("あと 6 マスで行けます")).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_225) })).toBeNull();
  });

  it("マスを全部終えると章のテストが出て、受けられる", () => {
    renderWith(withProgress("fraction", { fraction: { done: fractionCount, sides: [], test: false } }));
    expect(cardHeading().textContent).toContain("分数 のテスト");
    expect(card().getByText(plainText(COPY.CP_239))).toBeTruthy();
    expect(card().getByRole("button", { name: plainText(COPY.CP_219) })).toBeTruthy();
  });

  it("クリア後、次の章に学習があれば次の章へ移るボタンを出す", () => {
    // 見本の小数の章はクリア済みで、次の章は学習のある分数
    renderWith(withProgress("decimal", {}));
    expect(card().getByText(plainText(COPY.CP_229))).toBeTruthy();
    fireEvent.click(card().getByRole("button", { name: /^つぎの章へ：/ }));
    // 章が替わり、盤面の道も替わる（/sansu/{章の id} へ移る）
    expect(window.location.pathname).toBe("/sansu/fraction");
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("aria-label")).toContain("分数");
  });

  it("クリア後、学習のある章がもう無ければ、移るボタンを出さず文で伝える（D-133）", () => {
    // 学習の無い章は鍵なので、次の章として選ばれない。学習のある章を全部クリアした後は CP-221 になる
    const expression = CHAPTERS.find((chapter) => chapter.id === "expression");
    renderWith(withProgress("fraction", {
      fraction: { done: fractionCount, sides: [], test: true },
      expression: { done: expression?.items.length ?? 0, sides: [], test: true },
    }));
    expect(card().queryByRole("button")).toBeNull();
    expect(card().getByText(plainText(COPY.CP_221(SUBJECT_NAME)))).toBeTruthy();
    expect(card().queryByText(plainText(COPY.CP_229))).toBeNull();
  });

  it("全章をクリアしていれば CP-221 だけを出す", () => {
    const progress = Object.fromEntries(CHAPTERS.map((chapter) => [chapter.id, { done: chapter.items.length, sides: [], test: true }]));
    renderWith({ ...SEEN, progress });
    expect(card().getByText(plainText(COPY.CP_221()))).toBeTruthy();
    expect(card().queryByRole("button")).toBeNull();
  });

  it("学習の無い寄り道も「学習をはじめる」を出し、押すと CP-222 のトーストで止まる（D-93）", () => {
    renderWith(withProgress("integer", { integer: { done: 5, sides: [], test: false } }));
    // 整数の章の「応用」の寄り道は1つ。名前は学習指導要領の本文で長いので、種類の「応用」で探す
    fireEvent.click(within(road()).getByRole("button", { name: /^応用 / }));
    fireEvent.click(card().getByRole("button", { name: plainText(COPY.CP_225) }));
    expect(screen.getByTestId("toast").textContent).toBe(COPY.CP_222);
  });

  it("問題の無い章のテストは、受けられる時もボタンを出さず CP-286 を出す（D-117、D-133）", () => {
    // 章のテストの問題だけ無いことにする。マスは全部終えている
    missing.keys.add("test");
    renderWith(withProgress("fraction", { fraction: { done: fractionCount, sides: [], test: false } }));
    expect(card().getByText(plainText(COPY.CP_286))).toBeTruthy();
    expect(card().queryByRole("button", { name: plainText(COPY.CP_219) })).toBeNull();
    expect(card().queryByRole("button")).toBeNull();
  });

  it("問題の無いマスは CP-286 だけを出し、ボタンは出さない（D-117、D-133）", () => {
    missing.keys.add("main-1");
    renderWith(withProgress("fraction", { fraction: { done: 1, sides: [], test: false } }));
    expect(card().getByText(plainText(COPY.CP_286))).toBeTruthy();
    expect(card().queryByRole("button")).toBeNull();
  });

  it("問題のあるマスにはボタンが出て、じゅんび中とは書かない", () => {
    // 分数の章の今のマス（3 マス終えた次）には問題がある
    renderWith(SEEN);
    expect(card().getByRole("button", { name: plainText(COPY.CP_225) })).toBeTruthy();
    expect(card().queryByText(plainText(COPY.CP_286))).toBeNull();
  });

  it("終えた寄り道は CP-232 と学習をはじめる", () => {
    renderWith(withProgress("fraction", { fraction: { done: 3, sides: ["fraction-t2"], test: false } }));
    fireEvent.click(within(road()).getByRole("button", { name: /^特訓場/ }));
    expect(card().getByText(plainText(COPY.CP_232))).toBeTruthy();
    expect(card().getByRole("button", { name: plainText(COPY.CP_225) })).toBeTruthy();
  });

  it("中身を入れた所は aria-live=polite", () => {
    renderWith(SEEN);
    expect(screen.getByRole("complementary").querySelector("[aria-live='polite']")).not.toBeNull();
  });

  it("見出しにふりがなを入れず、名前に読み上げ用の文字だけを持つ", () => {
    renderWith(SEEN);
    expect(screen.getByRole("heading", { level: 2, name: "約分" })).toBeTruthy();
  });
});

// 顔のボタンと音のボタン、アカウントのパネルは右上の CMP-043 としてアプリに1組だけ置く（D-245）。
// 開く・閉じる・フォーカスが戻る動きの試験は App の試験へ移す
describe("右上の音と顔（CMP-043。D-245）", () => {
  it("盤面には音のボタンも顔のボタンもアカウントのパネルも無い。上の帯は右に --corner-reserve を空ける", () => {
    renderWith(SEEN);
    expect(screen.queryByRole("button", { name: "アカウント" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "アカウント" })).toBeNull();
    expect(document.querySelector(".top-bar .sound-button, .top-bar .sound-control, .top-bar .face")).toBeNull();
  });
});

describe("分数までクリアした状態", () => {
  it("学習の無い章へは送らない（D-133）", () => {
    // 次の章の候補は学習のある章だけ。分数のあとの平面図形（鍵）へ移るボタンも、CP-229 の文も出ない
    const expression = CHAPTERS.find((chapter) => chapter.id === "expression");
    renderWith(withProgress("fraction", {
      fraction: { done: fractionCount, sides: [], test: true },
      expression: { done: expression?.items.length ?? 0, sides: [], test: true },
    }));
    expect(card().queryByRole("button", { name: /^つぎの章へ：/ })).toBeNull();
    expect(card().queryByText(plainText(COPY.CP_229))).toBeNull();
    expect(window.location.pathname).toBe("/");
  });
});

// #370。学習を終えて盤面に戻った直後は、コマが歩く間も「学習をはじめる」の1回目の押しで入れる
describe("歩く間の押し（#370）", () => {
  afterEach(() => { vi.useRealTimers(); });

  it.each([
    ["学習をはじめるのボタン", () => card().getByRole("button", { name: plainText(COPY.CP_225) })],
    ["今のマス", () => within(road()).getByRole("button", { current: "step" })],
  ])("本線のマスを終えた直後に %s を1回押すと入れる", async (_name, pick) => {
    vi.useFakeTimers();
    renderWith(SEEN);
    let finished: Promise<void> = Promise.resolve();
    act(() => { finished = latestGame?.completeLesson({ kind: "main", index: 3 }) ?? Promise.resolve(); });
    expect(latestGame?.isBusy).toBe(true);
    fireEvent.click(pick());
    expect(window.location.pathname).toBe("/sansu/lesson/main-4");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); await finished; });
  });
});
