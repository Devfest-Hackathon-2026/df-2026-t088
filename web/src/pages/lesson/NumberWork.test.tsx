import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonDefinition } from "../../lesson/problems";
import type { NumberAnswer, NumberProblem, NumberTopic } from "../../lesson/number-problem";
import { ProblemCard } from "./ProblemCard";
import { useTileLesson } from "./use-tile-lesson";

vi.mock("../../audio/use-bgm", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../audio/use-bgm")>()), playSe: () => undefined }));

const f = (num: number, den: number) => ({ num, den });
const numberProblem = (topic: NumberTopic, answer: NumberAnswer): NumberProblem => ({
  kind: "number",
  pieces: [],
  hints: ["最初のヒント", "二つ目のヒント"],
  topic,
  answer,
});

const MULTIPLY = numberProblem(
  { t: "multiply", a: "12", b: "4.3", intA: 12, intB: 43, intProduct: 516, places: 1, answer: "51.6" },
  { type: "decimal", value: "51.6" },
);
const LCM = numberProblem({ t: "lcm", a: 4, b: 6, answer: 12 }, { type: "integer", value: 12 });
const PARITY = numberProblem({ t: "parity", n: 7, even: false }, { type: "choice", options: ["even", "odd"], correct: "odd" });
const DIVISORS = numberProblem({ t: "divisors", n: 8, list: [1, 2, 4, 8] }, { type: "multi", cards: [1, 2, 3, 4, 5, 6, 7, 8], correct: [1, 2, 4, 8] });
const REMAINDER = numberProblem(
  { t: "divideRemainder", a: "7.5", b: "2.3", quotient: 3, remainder: "0.6" },
  { type: "remainder", quotient: 3, remainder: "0.6" },
);
const RULE = { form: "add", a: 2, b: 0 } as const;
const TABLE_BLANK = numberProblem(
  { t: "tableBlank", rule: RULE, table: [{ x: "1", y: "3" }, { x: "2", y: null }, { x: "3", y: "5" }], x: "2", answer: "4" },
  { type: "decimal", value: "4" },
);
const PICK_RULE = numberProblem(
  { t: "pickRule", rule: RULE, table: [{ x: "1", y: "3" }, { x: "2", y: "4" }] },
  { type: "choice", options: ["mul:2:0", "add:2:0", "mulAdd:2:1"], correct: "add:2:0" },
);
const DISTRIBUTIVE = numberProblem({ t: "distributive", a: 30, b: 2, c: "0.5" }, { type: "decimal", value: "0.5" });
const INT_TO_FRACTION = numberProblem({ t: "intToFraction", n: 2, den: 3, count: 6 }, { type: "numerator", value: 6 });
const FRACTION = numberProblem(
  { t: "decimalToFraction", decimal: "0.13", unit: f(1, 100), count: 13, value: f(13, 100) },
  { type: "fraction", value: f(13, 100) },
);

function Harness({ definition }: { definition: LessonDefinition }) {
  const lesson = useTileLesson(definition, 0);
  return <ProblemCard lesson={lesson} />;
}

function open(...problems: NumberProblem[]) {
  render(<Harness definition={{ id: "number-ui", isTilesFirst: false, problems }} />);
}

// 式の行は分数の部品などで区切られるので、文字をつなげて見る
const expression = (): string => document.querySelector(".lesson-equation-row")?.textContent ?? "";
const after = (): string => document.querySelector(".lesson-after")?.textContent ?? "";
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("数を入れる欄", () => {
  it("小数の欄は inputmode=decimal。式の ? は正解の後に答えの数になる", () => {
    open(MULTIPLY, LCM);
    const input = screen.getByLabelText("こたえ（れい: 0.5）");
    expect(input.getAttribute("inputmode")).toBe("decimal");
    expect(expression()).toBe("12 × 4.3 = ?");
    type("こたえ（れい: 0.5）", "51.60");
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.getByText("12×43 = 516 の積の小数点を、左へ 1けたうつします")).toBeTruthy();
    expect(expression()).toBe("12 × 4.3 = 51.6");
    expect((screen.getByLabelText("こたえ（れい: 0.5）") as HTMLInputElement).readOnly).toBe(true);
    press("つぎの問題へ");
    expect(screen.getByLabelText("こたえ（れい: 12）").getAttribute("inputmode")).toBe("numeric");
  });

  it("読めない答えは CP-603、整数の欄は CP-604、空は CP-405 の流れで、まちがいの図は出ない", () => {
    open(MULTIPLY, LCM);
    press("こたえる");
    expect(screen.getByText("こたえを入れてください")).toBeTruthy();
    type("こたえ（れい: 0.5）", "1.2.3");
    press("こたえる");
    expect(screen.getByText("数で入れてください。（れい: 0.5）")).toBeTruthy();
    type("こたえ（れい: 0.5）", "5.16");
    press("こたえる");
    expect(screen.getByText("ちがうみたいです。「分かんない」をおすと、ヒントが見られます")).toBeTruthy();
    expect(screen.queryByText("図でくらべてみましょう")).toBeNull();
    type("こたえ（れい: 0.5）", "51.6");
    press("こたえる");
    press("つぎの問題へ");
    type("こたえ（れい: 12）", "1.5");
    press("こたえる");
    expect(screen.getByText("整数で入れてください。（れい: 12）")).toBeTruthy();
  });

  it("「分かんない」はヒントを1つずつ開く。タイルの案内は出ない", () => {
    open(LCM);
    press("分かんない");
    expect(within(screen.getByRole("list", { name: "ヒント" })).getAllByRole("listitem")).toHaveLength(1);
    press("分かんない");
    expect(screen.getByText("二つ目のヒント")).toBeTruthy();
    press("分かんない");
    expect(screen.getByText("ヒントはここまでです")).toBeTruthy();
    expect(screen.queryByText(/タイルで考えられます/)).toBeNull();
  });

  it("分数の答えは今の欄（CP-403）で、約分していなくてよい", () => {
    open(FRACTION);
    type("こたえ（れい: 1/2）", "26/200");
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(after()).toBe("0.13 は 1100 の 13こ分で 13100 です");
  });
});

describe("□ のある式と、△ と □ の表", () => {
  it("分子だけの欄は、式の □ の位置に出る", () => {
    open(INT_TO_FRACTION);
    expect(screen.getByText("□ に入る数を入れましょう")).toBeTruthy();
    expect(screen.getByLabelText("□ に入る数").getAttribute("inputmode")).toBe("numeric");
    type("□ に入る数", "6");
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.queryByLabelText("□ に入る数")).toBeNull();
  });

  it("分配のきまりは、式の □ の位置に欄が出て、別の答えの欄は出ない", () => {
    open(DISTRIBUTIVE);
    const row = document.querySelector(".lesson-equation-row") as HTMLElement;
    expect(within(row).getByLabelText("□ に入る数").getAttribute("inputmode")).toBe("decimal");
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    type("□ に入る数", "0.5");
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(expression()).toContain("30 × 2 + 30 × 0.5");
  });

  it("表の □ の1マスだけが欄。表は名前と、1列目の見出しを持つ", () => {
    open(TABLE_BLANK);
    const table = screen.getByRole("table", { name: "△ と □ の表" });
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["△", "□"]);
    expect(within(table).getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/^こたえ/)).toBeNull();
    expect(screen.getByText("表の □ に入る数を入れましょう")).toBeTruthy();
    type("□ に入る数", "4.5.1");
    press("こたえる");
    expect(screen.getByText("数で入れてください。（れい: 0.5）")).toBeTruthy();
    type("□ に入る数", "4");
    press("こたえる");
    expect(screen.getByText("□ = 2 + △ の △ に 2 を入れると、□ は 4 です")).toBeTruthy();
    expect((within(table).getByLabelText("□ に入る数") as HTMLInputElement).readOnly).toBe(true);
    expect(within(table).getByDisplayValue("4")).toBeTruthy();
  });

  it("式をえらぶ：選択肢は式、押して答える。表は空欄なし", () => {
    open(PICK_RULE);
    const table = screen.getByRole("table", { name: "△ と □ の表" });
    expect(within(table).queryAllByRole("textbox")).toHaveLength(0);
    const group = screen.getByRole("group", { name: "こたえる" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["□ = 2 × △", "□ = 2 + △", "□ = 2 × △ + 1"]);
    press("□ = 2 × △");
    expect(screen.getByText("ちがうみたいです。「分かんない」をおすと、ヒントが見られます")).toBeTruthy();
    press("□ = 2 + △");
    expect(screen.getByText("□ は、いつも △ に 2 をたした数です")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "□ = 2 × △" })).toBeNull();
  });
});

describe("1つ選ぶ", () => {
  it("選択肢を押して答える。「こたえる」のボタンは無い", () => {
    open(PARITY);
    expect(screen.queryByRole("button", { name: "こたえる" })).toBeNull();
    expect(screen.getByText("7 は偶数ですか、奇数ですか")).toBeTruthy();
    press("偶数");
    expect(screen.getByText("ちがうみたいです。「分かんない」をおすと、ヒントが見られます")).toBeTruthy();
    press("奇数");
    expect(screen.getByText("7 は 2 でわると 1 あまるので、奇数です")).toBeTruthy();
  });
});

describe("全部えらぶ（数の札）", () => {
  const cards = () => within(screen.getByRole("group", { name: "数の札" })).getAllByRole("button");

  it("札は aria-pressed で、押すたびに選ぶ・外す。選ぶと ✓ が付く", () => {
    open(DIVISORS);
    expect(cards()).toHaveLength(8);
    expect(cards().every((card) => card.getAttribute("aria-pressed") === "false")).toBe(true);
    press("1");
    expect(cards()[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(cards()[0]?.textContent).toContain("✓");
    press("1");
    expect(cards()[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(cards()[0]?.textContent).not.toContain("✓");
  });

  it("何も選ばない・足りない・入らない数がまじる時の文。合えば札を押せなくする", () => {
    open(DIVISORS);
    press("こたえる");
    expect(screen.getByText("えらんでから、「こたえる」をおしてください")).toBeTruthy();
    press("1");
    press("こたえる");
    expect(screen.getByText("ちがうみたいです。まだ入っていない数があります")).toBeTruthy();
    press("3");
    press("こたえる");
    expect(screen.getByText("ちがうみたいです。入らない数がまじっています")).toBeTruthy();
    press("3");
    for (const card of ["2", "4", "8"]) press(card);
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.getByText("8 の約数は 1, 2, 4, 8 です")).toBeTruthy();
    expect(cards().every((card) => (card as HTMLButtonElement).disabled)).toBe(true);
    expect(cards().filter((card) => card.getAttribute("aria-pressed") === "true")).toHaveLength(4);
  });
});

describe("商とあまり", () => {
  it("2つの欄を並べ、どちらかが空なら CP-611。式は「=」まで", () => {
    open(REMAINDER);
    expect(expression()).toBe("7.5 ÷ 2.3 =");
    expect(screen.getByText("商は整数で求めて、あまりも出しましょう")).toBeTruthy();
    type("商", "3");
    press("こたえる");
    expect(screen.getByText("商とあまりを、どちらも入れてください")).toBeTruthy();
    type("あまり", "0.6");
    press("こたえる");
    expect(screen.getByText("せいかいです")).toBeTruthy();
    expect(screen.getByText("2.3×3＋0.6 = 7.5 です")).toBeTruthy();
  });
});
