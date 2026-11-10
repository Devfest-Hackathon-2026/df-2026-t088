import { describe, expect, it } from "vitest";
import type { ExpressionForm, ExpressionRule, NumberProblem } from "../number-problem";
import { EXPRESSION_MAKERS } from "./expression";
import { problemIdOf } from "./format";
import type { Arg, ProblemMaker } from "./types";

const maker = (name: string): ProblemMaker => {
  const found = EXPRESSION_MAKERS.find((entry) => entry.name === name);
  if (!found) throw new Error(`関数がありません: ${name}`);
  return found;
};

const ok = (name: string, args: unknown[]): boolean => maker(name).check(args).ok;

function built(name: string, args: Arg[]): NumberProblem {
  const problem = maker(name).build(args);
  if (problem.kind !== "number") throw new Error("数の問題ではありません");
  return problem;
}

const verifyOf = (name: string, problem: NumberProblem) => maker(name).verify(problem);

describe("関数の一覧", () => {
  it("式の3つで、どれも数の問題", () => {
    expect(EXPRESSION_MAKERS.map((entry) => entry.name)).toEqual(["expression.pickRule", "expression.tableBlank", "expression.evaluate"]);
    expect(EXPRESSION_MAKERS.every((entry) => entry.kind === "number")).toBe(true);
  });
});

describe("check の境目", () => {
  it("pickRule：a は 1〜9、b は mulAdd だけ 1〜9（add・mul は 0）", () => {
    expect(ok("expression.pickRule", ["add", 1, 0])).toBe(true);
    expect(ok("expression.pickRule", ["add", 9, 0])).toBe(true);
    expect(ok("expression.pickRule", ["add", 0, 0])).toBe(false);
    expect(ok("expression.pickRule", ["add", 10, 0])).toBe(false);
    expect(ok("expression.pickRule", ["mul", 9, 0])).toBe(true);
    expect(ok("expression.pickRule", ["mul", 2, 1])).toBe(false);
    expect(ok("expression.pickRule", ["add", 2, 1])).toBe(false);
    expect(ok("expression.pickRule", ["mulAdd", 3, 1])).toBe(true);
    expect(ok("expression.pickRule", ["mulAdd", 9, 9])).toBe(true);
    expect(ok("expression.pickRule", ["mulAdd", 3, 0])).toBe(false);
    expect(ok("expression.pickRule", ["mulAdd", 3, 10])).toBe(false);
    expect(ok("expression.pickRule", ["sub", 3, 0])).toBe(false);
    expect(ok("expression.pickRule", ["add", 2.5, 0])).toBe(false);
    expect(ok("expression.pickRule", ["add", "2", 0])).toBe(false);
    expect(ok("expression.pickRule", ["add", 2])).toBe(false);
  });

  it("tableBlank：x は 1〜10 の整数", () => {
    expect(ok("expression.tableBlank", ["add", 2, 0, 1])).toBe(true);
    expect(ok("expression.tableBlank", ["add", 2, 0, 10])).toBe(true);
    expect(ok("expression.tableBlank", ["add", 2, 0, 0])).toBe(false);
    expect(ok("expression.tableBlank", ["add", 2, 0, 11])).toBe(false);
    expect(ok("expression.tableBlank", ["add", 2, 0, 2.5])).toBe(false);
    expect(ok("expression.tableBlank", ["add", 2, 0, "5"])).toBe(false);
    expect(ok("expression.tableBlank", ["mulAdd", 2, 0, 5])).toBe(false);
    expect(ok("expression.tableBlank", ["mulAdd", 2, 5, 3])).toBe(true);
  });

  it("evaluate：x は 1〜10 の整数か、0.5〜9.5 の 0.5 きざみ", () => {
    for (const x of [1, 10, 8, "0.5", "1.5", "2.5", "9.5", "7"]) expect(ok("expression.evaluate", ["mul", 4, 0, x])).toBe(true);
    for (const x of [0, 11, "0", "0.4", "0.25", "2.55", "9.6", "10.5", "10.0", "2.50", 2.5, 0.5, "abc", -1, null]) {
      expect(ok("expression.evaluate", ["mul", 4, 0, x])).toBe(false);
    }
  });

  it("evaluate：整数も文字にそろえる", () => {
    expect(maker("expression.evaluate").check(["add", 3, 0, 8])).toEqual({ ok: true, args: ["add", 3, 0, "8"] });
    expect(maker("expression.tableBlank").check(["add", 5, 0, 6])).toEqual({ ok: true, args: ["add", 5, 0, 6] });
  });

  it("build は check を通らない args で RangeError", () => {
    expect(() => maker("expression.pickRule").build(["add", 10, 0])).toThrow(RangeError);
    expect(() => maker("expression.tableBlank").build(["add", 2, 0, 11])).toThrow(RangeError);
    expect(() => maker("expression.evaluate").build(["mul", 4, 0, "0.4"])).toThrow(RangeError);
  });
});

describe("build の answer と topic", () => {
  it("pickRule：表は △=1〜4、選択肢は正解とまちがい 2 つ", () => {
    const problem = built("expression.pickRule", ["add", 2, 0]);
    expect(problem.topic).toEqual({
      t: "pickRule",
      rule: { form: "add", a: 2, b: 0 },
      table: [{ x: "1", y: "3" }, { x: "2", y: "4" }, { x: "3", y: "5" }, { x: "4", y: "6" }],
    });
    expect(problem.answer.type).toBe("choice");
    if (problem.answer.type !== "choice") return;
    expect(problem.answer.correct).toBe("add:2:0");
    expect(problem.answer.options).toHaveLength(3);
    expect(problem.answer.options).toContain("add:2:0");
    const mul = built("expression.pickRule", ["mulAdd", 3, 1]);
    expect(mul.topic).toMatchObject({ table: [{ x: "1", y: "4" }, { x: "2", y: "7" }, { x: "3", y: "10" }, { x: "4", y: "13" }] });
  });

  it("pickRule：まちがいの式の例（add:2:0 の時）", () => {
    // かけ算のとりちがえ mul:2:0 は △=2、mul:3:0 は △=1 で正解と同じ □ になるので使わず、どの列でも合わない式を選ぶ
    const problem = built("expression.pickRule", ["add", 2, 0]);
    if (problem.answer.type !== "choice") throw new Error("choice ではありません");
    expect(problem.answer.options.filter((id) => id !== "add:2:0")).toEqual(["add:3:0", "add:1:0"]);
    const mulAdd = built("expression.pickRule", ["mulAdd", 3, 1]);
    if (mulAdd.answer.type !== "choice") throw new Error("choice ではありません");
    expect(mulAdd.answer.options.filter((id) => id !== "mulAdd:3:1")).toEqual(["mul:3:0", "add:1:0"]) // a と b を入れかえた mulAdd:1:3 は △=1 の列で同じになるので使わない;
  });

  it("pickRule：順番は乱数でなく式で決まる（同じ args なら同じ並び）", () => {
    const first = built("expression.pickRule", ["mul", 4, 0]);
    const second = built("expression.pickRule", ["mul", 4, 0]);
    expect(first.answer).toEqual(second.answer);
    const positions = new Set<number>();
    for (const [form, a, b] of [["add", 2, 0], ["mul", 2, 0], ["mulAdd", 3, 1], ["mul", 5, 0], ["add", 7, 0]] as [ExpressionForm, number, number][]) {
      const problem = built("expression.pickRule", [form, a, b]);
      if (problem.answer.type !== "choice") throw new Error("choice ではありません");
      positions.add(problem.answer.options.indexOf(problem.answer.correct));
    }
    expect(positions.size).toBeGreaterThan(1); // 正解がいつも同じ場所には来ない
  });

  it("pickRule：すべての式で、まちがいの式が 4 列のどこでも正解と同じ □ にならない", () => {
    const rules: ExpressionRule[] = [];
    for (let a = 1; a <= 9; a += 1) {
      rules.push({ form: "add", a, b: 0 }, { form: "mul", a, b: 0 });
      for (let b = 1; b <= 9; b += 1) rules.push({ form: "mulAdd", a, b });
    }
    expect(rules).toHaveLength(99);
    for (const rule of rules) {
      const args: Arg[] = [rule.form, rule.a, rule.b];
      const result = maker("expression.pickRule").check(args);
      expect(result.ok, `${rule.form}:${rule.a}:${rule.b}`).toBe(true);
      const problem = built("expression.pickRule", args);
      expect(verifyOf("expression.pickRule", problem)).toBeNull();
      if (problem.answer.type !== "choice" || problem.topic.t !== "pickRule") throw new Error("pickRule ではありません");
      expect(new Set(problem.answer.options).size).toBe(3);
      expect(problem.answer.options).toContain(problem.answer.correct);
    }
  });

  it("tableBlank：x を含む連続した 4 列で、x の □ だけが空欄", () => {
    const problem = built("expression.tableBlank", ["add", 5, 0, 6]);
    expect(problem.topic).toEqual({
      t: "tableBlank",
      rule: { form: "add", a: 5, b: 0 },
      table: [{ x: "5", y: "10" }, { x: "6", y: null }, { x: "7", y: "12" }, { x: "8", y: "13" }],
      x: "6",
      answer: "11",
    });
    expect(problem.answer).toEqual({ type: "decimal", value: "11" });
    // 端：x=1 は 1〜4、x=10 は 7〜10
    expect(built("expression.tableBlank", ["mul", 3, 0, 1]).topic).toMatchObject({ table: [{ x: "1", y: null }, { x: "2", y: "6" }, { x: "3", y: "9" }, { x: "4", y: "12" }], answer: "3" });
    expect(built("expression.tableBlank", ["mul", 3, 0, 10]).topic).toMatchObject({ table: [{ x: "7", y: "21" }, { x: "8", y: "24" }, { x: "9", y: "27" }, { x: "10", y: null }], answer: "30" });
    expect(built("expression.tableBlank", ["mulAdd", 2, 5, 3]).answer).toEqual({ type: "decimal", value: "11" });
  });

  it("evaluate：整数でも小数でも文字で返す", () => {
    expect(built("expression.evaluate", ["mul", 4, 0, "2.5"]).answer).toEqual({ type: "decimal", value: "10" });
    expect(built("expression.evaluate", ["mul", 4, 0, "2.5"]).topic).toEqual({ t: "evaluate", rule: { form: "mul", a: 4, b: 0 }, x: "2.5", answer: "10" });
    expect(built("expression.evaluate", ["add", 3, 0, 8]).answer).toEqual({ type: "decimal", value: "11" });
    expect(built("expression.evaluate", ["mulAdd", 2, 1, "1.5"]).answer).toEqual({ type: "decimal", value: "4" });
    expect(built("expression.evaluate", ["mul", 3, 0, 10]).answer).toEqual({ type: "decimal", value: "30" });
    expect(built("expression.evaluate", ["mulAdd", 4, 3, "0.5"]).answer).toEqual({ type: "decimal", value: "5" });
    expect(built("expression.evaluate", ["mulAdd", 3, 2, "2.5"]).answer).toEqual({ type: "decimal", value: "9.5" });
    // 浮動小数の誤差が出る組：7 × 0.5 + 0.1 のような和は使わないが、9 × 9.5 = 85.5 や 7 × 1.5 も正確
    expect(built("expression.evaluate", ["mul", 9, 0, "9.5"]).answer).toEqual({ type: "decimal", value: "85.5" });
    expect(built("expression.evaluate", ["mul", 7, 0, "0.5"]).answer).toEqual({ type: "decimal", value: "3.5" });
    expect(built("expression.evaluate", ["add", 9, 0, "9.5"]).answer).toEqual({ type: "decimal", value: "18.5" });
  });

  it("ヒントは数を入れず、2〜3 個で、ふりがなが付く", () => {
    for (const [name, args] of [["expression.pickRule", ["mul", 4, 0]], ["expression.tableBlank", ["add", 5, 0, 6]], ["expression.evaluate", ["mulAdd", 3, 2, "2.5"]], ["expression.evaluate", ["mul", 3, 0, 4]]] as [string, Arg[]][]) {
      const problem = built(name, args);
      expect(problem.pieces).toEqual([]);
      expect(problem.hints.length).toBeGreaterThanOrEqual(2);
      expect(problem.hints.length).toBeLessThanOrEqual(3);
      for (const hint of problem.hints) {
        expect(hint).not.toMatch(/\d/);
        expect(hint.replace(/\[[^\]|]+\|[^\]]+\]/g, "")).not.toMatch(/[二-龠々]/u);
      }
    }
  });

  it("ヒントの文の例", () => {
    expect(built("expression.pickRule", ["add", 2, 0]).hints[0]).toBe("[表|ひょう]の △ が[一|ひと]つふえると、□ がいくつふえるか[見|み]てみましょう");
    expect(built("expression.tableBlank", ["add", 5, 0, 6]).hints[0]).toBe("[表|ひょう]のほかの[列|れつ]を[見|み]て、△ と □ のきまりを[見|み]つけましょう");
    expect(built("expression.evaluate", ["mulAdd", 3, 2, "2.5"]).hints[1]).toBe("かけ[算|ざん]を[先|さき]に[計算|けいさん]して、あとでたします");
    expect(built("expression.evaluate", ["mulAdd", 3, 2, "2.5"]).hints[2]).toBe("[小数|しょうすう]の[計算|けいさん]では、[小数点|しょうすうてん]の[位置|いち]に[気|き]をつけましょう");
  });
});

describe("問題の id", () => {
  it("form は文字、x は文字か数", () => {
    const pick = maker("expression.pickRule").check(["mulAdd", 3, 1]);
    if (!pick.ok) throw new Error(pick.reason);
    expect(problemIdOf("expression.pickRule", pick.args)).toBe("expression.pickRule(mulAdd,3,1)");
    const blank = maker("expression.tableBlank").check(["mul", 3, 0, 4]);
    if (!blank.ok) throw new Error(blank.reason);
    expect(problemIdOf("expression.tableBlank", blank.args)).toBe("expression.tableBlank(mul,3,0,4)");
    const evaluate = maker("expression.evaluate").check(["mul", 4, 0, "2.5"]);
    if (!evaluate.ok) throw new Error(evaluate.reason);
    expect(problemIdOf("expression.evaluate", evaluate.args)).toBe("expression.evaluate(mul,4,0,2.5)");
  });
});

describe("verify が落ちる例", () => {
  it("正しい問題は null", () => {
    expect(verifyOf("expression.pickRule", built("expression.pickRule", ["add", 2, 0]))).toBeNull();
    expect(verifyOf("expression.tableBlank", built("expression.tableBlank", ["add", 5, 0, 6]))).toBeNull();
    expect(verifyOf("expression.evaluate", built("expression.evaluate", ["mul", 4, 0, "2.5"]))).toBeNull();
  });

  it("pickRule：表に合うまちがいの式が混ざっている", () => {
    const problem = built("expression.pickRule", ["add", 2, 0]);
    if (problem.answer.type !== "choice") throw new Error("choice ではありません");
    // mul:2:0 は △=2 の列で □=4 になり、正解 add:2:0 と同じ
    const options = problem.answer.options.map((id) => (id === "add:3:0" ? "mul:2:0" : id));
    expect(verifyOf("expression.pickRule", { ...problem, answer: { ...problem.answer, options } })).toContain("mul:2:0");
    // 表と完全に同じ式（mulAdd:1:2 は □＝1×△＋2 で add:2:0 と同じ）
    const same = problem.answer.options.map((id) => (id === "add:3:0" ? "mulAdd:1:2" : id));
    expect(verifyOf("expression.pickRule", { ...problem, answer: { ...problem.answer, options: same } })).toContain("mulAdd:1:2");
  });

  it("pickRule：選択肢の数・重なり・正解・表がおかしい", () => {
    const problem = built("expression.pickRule", ["add", 2, 0]);
    if (problem.answer.type !== "choice") throw new Error("choice ではありません");
    const { options, correct } = problem.answer;
    expect(verifyOf("expression.pickRule", { ...problem, answer: { type: "choice", options: options.slice(0, 2), correct } })).toContain("3 つ");
    expect(verifyOf("expression.pickRule", { ...problem, answer: { type: "choice", options: [options[0], options[0], options[1]], correct } })).toContain("3 つ");
    expect(verifyOf("expression.pickRule", { ...problem, answer: { type: "choice", options, correct: "mul:9:0" } })).toContain("add:2:0");
    expect(verifyOf("expression.pickRule", { ...problem, answer: { type: "choice", options: ["add:2:0", "xx", "mul:3:0"], correct } })).toContain("xx");
    expect(verifyOf("expression.pickRule", { ...problem, topic: { ...problem.topic, table: [{ x: "1", y: "3" }] } as NumberProblem["topic"] })).toContain("表");
  });

  it("pickRule：ヒントに式の数が入っている", () => {
    const problem = built("expression.pickRule", ["add", 2, 0]);
    expect(verifyOf("expression.pickRule", { ...problem, hints: [problem.hints[0], "2 をたします"] })).toContain("2");
  });

  it("tableBlank：答え・表・ヒント", () => {
    const problem = built("expression.tableBlank", ["add", 5, 0, 6]);
    expect(verifyOf("expression.tableBlank", { ...problem, answer: { type: "decimal", value: "12" } })).toContain("11");
    expect(verifyOf("expression.tableBlank", { ...problem, hints: [problem.hints[0], "□ は 11 です"] })).toContain("11");
    if (problem.topic.t !== "tableBlank") throw new Error("tableBlank ではありません");
    const filled = problem.topic.table.map((column) => (column.y === null ? { ...column, y: "11" } : column));
    expect(verifyOf("expression.tableBlank", { ...problem, topic: { ...problem.topic, table: filled } })).toContain("表");
    const wrongColumn = problem.topic.table.map((column) => (column.x === "5" ? { ...column, y: "9" } : column));
    expect(verifyOf("expression.tableBlank", { ...problem, topic: { ...problem.topic, table: wrongColumn } })).toContain("表");
  });

  it("evaluate：答え・x・ヒント", () => {
    const problem = built("expression.evaluate", ["mul", 4, 0, "2.5"]);
    expect(verifyOf("expression.evaluate", { ...problem, answer: { type: "decimal", value: "1" } })).toContain("10");
    expect(verifyOf("expression.evaluate", { ...problem, topic: { t: "evaluate", rule: { form: "mul", a: 4, b: 0 }, x: "2.4", answer: "10" } })).toContain("x");
    expect(verifyOf("expression.evaluate", { ...problem, hints: [problem.hints[0], "答えは 10 です"] })).toContain("10");
    // 100 の中の 10 は答えとして数えない
    expect(verifyOf("expression.evaluate", { ...problem, hints: [problem.hints[0], "100 ではありません"] })).toBeNull();
  });

  it("別の関数の問題は落ちる", () => {
    expect(verifyOf("expression.evaluate", built("expression.tableBlank", ["add", 5, 0, 6]))).toContain("evaluate");
  });

  it("答えがヒントに出てしまう組は check で落ちる", () => {
    // ヒントに数を書かないので、x と答えが同じ mul:1（□＝△）も通る
    expect(ok("expression.evaluate", ["mul", 1, 0, 5])).toBe(true);
  });
});

describe("既定の出題表（default-plan.md の式の行）", () => {
  const rows: [string, Arg[]][] = [
    ["expression.pickRule", ["add", 2, 0]], ["expression.pickRule", ["mul", 2, 0]], ["expression.pickRule", ["mulAdd", 3, 1]], ["expression.pickRule", ["mul", 5, 0]], ["expression.pickRule", ["add", 7, 0]],
    ["expression.tableBlank", ["add", 2, 0, 5]], ["expression.tableBlank", ["mul", 3, 0, 4]], ["expression.tableBlank", ["mulAdd", 3, 1, 6]], ["expression.tableBlank", ["mulAdd", 2, 5, 3]], ["expression.tableBlank", ["mul", 6, 0, 7]],
    ["expression.evaluate", ["mul", 4, 0, "2.5"]], ["expression.evaluate", ["add", 3, 0, 8]], ["expression.evaluate", ["mulAdd", 2, 1, "1.5"]], ["expression.evaluate", ["mul", 3, 0, 10]], ["expression.evaluate", ["mulAdd", 4, 3, "0.5"]],
    // expression-t
    ["expression.pickRule", ["mul", 4, 0]], ["expression.tableBlank", ["add", 5, 0, 6]], ["expression.pickRule", ["mulAdd", 2, 3]], ["expression.tableBlank", ["mul", 7, 0, 3]], ["expression.tableBlank", ["mulAdd", 5, 2, 4]],
    // テスト
    ["expression.pickRule", ["mulAdd", 4, 1]], ["expression.tableBlank", ["mul", 8, 0, 5]], ["expression.evaluate", ["mulAdd", 3, 2, "2.5"]],
  ];

  it.each(rows.map((row) => [problemIdOf(row[0], row[1]), row] as const))("%s は check・build・verify を通る", (_id, [name, args]) => {
    const target = maker(name);
    const checked = target.check(args);
    if (!checked.ok) throw new Error(checked.reason);
    expect(target.verify(target.build(checked.args))).toBeNull();
  });
});
