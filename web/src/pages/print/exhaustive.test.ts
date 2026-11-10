// 起こりうる入力を全部回す試験（乱数なし）。てこと分数の規則を、server の検査の通る範囲すべてで確かめる。
// server の検査（server/src/print/templates.ts）は別パッケージなので、動的 import で読む（型検査の対象に入れない）。
import { describe, expect, it } from "vitest";
import { classifyWrongAnswer } from "../../lesson/error-pattern";
import type { Fraction, Operator } from "../../lesson/fraction";
import { calculate } from "../../lesson/fraction";
import { calculateProblem } from "../../lesson/problems";
import { fractionRangeReason } from "./fraction-addsub";
import { classifyLeverWrongAnswer, leverAnswer, leverChoices } from "./templates";
import type { FractionAddSubParams, LeverParams } from "./types";

type ServerTemplates = { PRINT_TEMPLATES: { id: string; validateParams: (params: unknown) => string[] }[] };
// import.meta.glob なら tsc は server 側の .ts 拡張子 import をたどらない
const serverModules = import.meta.glob<ServerTemplates>("../../../../server/src/print/templates.ts");
const serverValidator = async (id: string) => {
  const load = Object.values(serverModules)[0];
  if (!load) throw new Error("server/src/print/templates.ts が読めない");
  const { PRINT_TEMPLATES } = await load();
  const template = PRINT_TEMPLATES.find((item) => item.id === id);
  if (!template) throw new Error(`server に ${id} が無い`);
  return template.validateParams;
};

const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

describe("てこ: 検査を通る入力すべて", () => {
  it("選択肢と型の規則が全部の組で成り立つ", async () => {
    const validate = await serverValidator("rika-lever");
    let total = 0;
    let withoutWrongPattern = 0;
    const examples: string[] = [];
    const failures: string[] = [];
    for (const lp of range(1, 6)) for (const g of range(10, 100, 10)) for (const rp of range(1, 6)) {
      const params: LeverParams = { left: { pos: lp, g }, right: { pos: rp } };
      if (validate(params).length > 0) continue;
      total += 1;
      const tag = `L${lp}x${g}g R${rp}`;
      const answer = leverAnswer(params);
      const choices = leverChoices(params);
      const sorted = [...choices].sort((a, b) => a - b);
      const ok = choices.length === 3 && choices.every((c, i) => c === sorted[i]) && new Set(choices).size === 3
        && choices.every((c) => Number.isInteger(c) && c >= 10 && c <= 100 && c % 10 === 0) && choices.filter((c) => c === answer).length === 1
        && (g === answer || choices.includes(g));
      if (!ok) failures.push(`${tag} choices=${choices.join(",")} answer=${answer}`);
      if (classifyLeverWrongAnswer(params, answer) !== "unclassified") failures.push(`${tag} 正解に型が付いた`);
      const inverse = (g * lp) / rp === answer ? (g * rp) / lp : (g * rp) / lp;
      if (g !== answer && classifyLeverWrongAnswer(params, g) !== (g === inverse ? "unclassified" : "lever-same-weight")) failures.push(`${tag} same-weight`);
      if (choices.includes(inverse) && inverse !== answer && classifyLeverWrongAnswer(params, inverse) !== (g === inverse ? "unclassified" : "lever-inverse")) failures.push(`${tag} inverse`);
      if (!choices.some((c) => c !== answer && classifyLeverWrongAnswer(params, c) !== "unclassified")) {
        withoutWrongPattern += 1;
        if (examples.length < 5) examples.push(`${tag} answer=${answer} choices=${choices.join(",")}`);
      }
    }
    // 現状の記録（落とさない）
    console.log(`[lever] 全 ${total} 組、型の付く間違いが選択肢に 1 つも無い組: ${withoutWrongPattern}。例: ${examples.join(" / ")}`);
    expect(failures.slice(0, 10)).toEqual([]);
    expect(total).toBeGreaterThan(0);
  });
});

const fractions = (): Fraction[] => range(2, 12).flatMap((den) => range(1, 24).map((num) => ({ num, den })));
const gcdOf = (a: number, b: number): number => (b === 0 ? a : gcdOf(b, a % b));
const OPS: Operator[] = ["+", "-"];

describe("分数: web の範囲と server の検算の一致、間違え方の型", () => {
  it("全部の組で web と server の判定が同じ、受ける組で型の規則が成り立つ", async () => {
    const validate = await serverValidator("sansu-fraction-addsub");
    const all = fractions();
    let total = 0;
    let accepted = 0;
    const mismatches: string[] = [];
    let mismatchCount = 0;
    const reasons = new Map<string, number>();
    let webOnly = 0;
    let serverOnly = 0;
    const typeFailures: string[] = [];
    let unclassifiedCommon = 0;
    const unclassifiedExamples: string[] = [];
    let commonTotal = 0;
    for (const left of all) for (const op of OPS) for (const right of all) {
      total += 1;
      const params: FractionAddSubParams = { left, op, right };
      const webOk = fractionRangeReason(params) === null;
      const serverOk = validate(params).length === 0;
      if (webOk !== serverOk) { const why = fractionRangeReason(params) ?? ""; reasons.set(why, (reasons.get(why) ?? 0) + 1); mismatchCount += 1; if (webOk) webOnly += 1; else serverOnly += 1; }
      if (webOk !== serverOk && mismatches.length < 5) mismatches.push(`${left.num}/${left.den} ${op} ${right.num}/${right.den} web=${webOk ? "受ける" : "断る"} server=${serverOk ? "通す" : "落とす"}`);
      if (!webOk) continue;
      accepted += 1;
      const problem = calculateProblem(left, op, right);
      const text = (n: number, d: number) => `${n}/${d}`;
      try {
        const correct = calculate(left, op, right);
        if (classifyWrongAnswer(problem, text(correct.num, correct.den)) !== "unclassified") typeFailures.push(`正解に型 ${text(left.num, left.den)}${op}${text(right.num, right.den)}`);
        const bothNum = op === "+" ? left.num + right.num : left.num - right.num;
        const bothDen = op === "+" ? left.den + right.den : left.den - right.den;
        const result = classifyWrongAnswer(problem, text(bothNum, bothDen));
        const label = `${text(left.num, left.den)}${op}${text(right.num, right.den)}→${text(bothNum, bothDen)}`;
        const sameValue = (a: Fraction, b: Fraction) => a.num * b.den === b.num * a.den;
        const both = { num: bothNum, den: bothDen };
        const lcm = left.den * right.den / gcdOf(left.den, right.den);
        // 今の決まりで sum-both 以外になってよい場合: 使えない値、正解と同じ、同じ分母のたし算(#264)、ほかの型の答えと同じ
        const excused = bothNum <= 0 || bothDen <= 0 || sameValue(both, correct) || (op === "+" && left.den === right.den)
          || [left.den, right.den, left.den * right.den, lcm].some((den) => sameValue(both, { num: bothNum, den }))
          || (op === "+" && sameValue(both, { num: correct.num, den: correct.den * 2 }));
        if (result !== "sum-both" && !excused) typeFailures.push(`sum-both が ${result}: ${label}`);
        if (result !== "sum-both") {
          unclassifiedCommon += 1;
          if (unclassifiedExamples.length < 5) unclassifiedExamples.push(`${label}(${result})`);
        }
        commonTotal += 1;
      } catch (error) {
        typeFailures.push(`例外 ${text(left.num, left.den)}${op}${text(right.num, right.den)}: ${String(error)}`);
      }
    }
    console.log(`[fraction] 全 ${total} 組、web が受ける組 ${accepted}、「分子どうし・分母どうし」の答えが sum-both 以外になる組（同じ分母のたし算など、今の決まりで許す組を含む） ${unclassifiedCommon}/${commonTotal}。例: ${unclassifiedExamples.join(" / ")}`);
    console.log(`[fraction] 食い違い ${mismatchCount} 組 (web だけ受ける ${webOnly} / server だけ通す ${serverOnly})。web の断る理由: ${JSON.stringify([...reasons])}`);
    expect.soft(mismatches).toEqual([]);
    expect(typeFailures.slice(0, 10)).toEqual([]);
  }, 120_000);
});
