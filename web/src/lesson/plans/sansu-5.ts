// 5年の算数の既定の出題表（docs/design/problems/08_database/default-plan.md）。キーは学習の名前（`{章 id}:{key}`）
// integer-a・decimal-a（応用）と、図形などの章は出題表を持たない（盤面ではじゅんび中。PB-14）
import type { Fraction } from "../fraction";
import type { Arg, LessonPlan, PlanEntry } from "../makers/types";

const f = (num: number, den: number): Fraction => ({ num, den });
const ONE = f(1, 1);
const HALF = f(1, 2);

/** 分数以外の行。関数名は章の名前つきで書く（例 `row("integer.gcd", 16, 24)`） */
const row = (maker: string, ...args: Arg[]): PlanEntry => ({ maker, args });
const divide = (dividend: number, divisor: number): PlanEntry => row("fraction.divide", dividend, divisor);
const toDecimal = (num: number, den: number): PlanEntry => row("number.fractionToDecimal", num, den);
const equivalent = (num: number, den: number, target: number): PlanEntry => row("fraction.equivalent", num, den, target);

const reduce = (value: Fraction, wrongUnit: Fraction): PlanEntry => ({ maker: "fraction.reduce", args: [value, wrongUnit] });
const common = (left: Fraction, right: Fraction): PlanEntry => ({ maker: "fraction.common", args: [left, right] });
const compare = (left: Fraction, right: Fraction): PlanEntry => ({ maker: "fraction.compare", args: [left, right] });
const calculate = (left: Fraction, op: "+" | "-", right: Fraction, showMixed = false): PlanEntry => ({
  maker: "fraction.calculate", args: showMixed ? [left, op, right, true] : [left, op, right],
});
const plain = (left: Fraction, op: "+" | "-", right: Fraction): PlanEntry => ({ maker: "fraction.plain", args: [left, op, right] });
const estimate = (left: Fraction, op: "+" | "-", right: Fraction, threshold: Fraction): PlanEntry => ({
  maker: "fraction.estimate", args: [left, op, right, threshold],
});

const parity = (n: number): PlanEntry => row("integer.parity", n);
const divisors = (n: number): PlanEntry => row("integer.divisors", n);
const multiples = (n: number, max: number): PlanEntry => row("integer.multiples", n, max);
const commonDivisors = (a: number, b: number): PlanEntry => row("integer.commonDivisors", a, b);
const gcd = (a: number, b: number): PlanEntry => row("integer.gcd", a, b);
const commonMultiple = (a: number, b: number, count: number): PlanEntry => row("integer.commonMultiple", a, b, count);
const lcm = (a: number, b: number): PlanEntry => row("integer.lcm", a, b);

const shift = (x: string, factor: Arg): PlanEntry => row("decimal.shift", x, factor);
/** 整数の数も、関数が返す形（小数の文字）で書く */
const compareProduct = (a: number | string, b: string): PlanEntry => row("decimal.compareProduct", String(a), b);
const multiply = (a: number | string, b: string): PlanEntry => row("decimal.multiply", String(a), b);
const compareQuotient = (a: number | string, b: string): PlanEntry => row("decimal.compareQuotient", String(a), b);
const divideDecimal = (a: number | string, b: string): PlanEntry => row("decimal.divide", String(a), b);
const divideRemainder = (a: string, b: string): PlanEntry => row("decimal.divideRemainder", a, b);
const distributive = (a: number, b: number, c: string): PlanEntry => row("decimal.distributive", a, b, c);
const TENTH = f(1, 10);
const HUNDREDTH = f(1, 100);

const pickRule = (form: string, a: number, b: number): PlanEntry => row("expression.pickRule", form, a, b);
const tableBlank = (form: string, a: number, b: number, x: number): PlanEntry => row("expression.tableBlank", form, a, b, x);
const evaluate = (form: string, a: number, b: number, x: number | string): PlanEntry => row("expression.evaluate", form, a, b, String(x));

export const DEFAULT_PLANS: Readonly<Record<string, LessonPlan>> = {
  "fraction:main-0": { intro: "division", entries: [divide(3, 4), divide(2, 5), divide(7, 3), divide(5, 2), divide(6, 3)] },
  "fraction:main-1": {
    intro: "decimal",
    entries: [
      toDecimal(1, 4), row("number.decimalToFraction", "0.13"), row("number.intToFraction", 2, 3), toDecimal(3, 8),
      row("number.terminates", 1, 3),
    ],
  },
  "fraction:main-2": {
    intro: "equivalent",
    entries: [equivalent(1, 2, 4), equivalent(2, 3, 6), equivalent(3, 4, 12), equivalent(4, 6, 3), equivalent(6, 8, 4)],
  },
  "fraction:main-3": {
    entries: [
      reduce(f(4, 6), HALF), reduce(f(6, 8), f(1, 3)), reduce(f(8, 12), f(1, 5)),
      reduce(f(6, 10), f(1, 3)), reduce(f(12, 16), f(1, 3)),
    ],
  },
  "fraction:main-4": {
    entries: [
      common(HALF, f(1, 3)), common(f(1, 4), f(1, 6)), common(f(2, 3), f(1, 4)),
      common(f(3, 5), HALF), common(f(1, 6), f(3, 8)),
    ],
  },
  "fraction:main-5": {
    entries: [
      compare(HALF, f(2, 5)), compare(f(5, 8), f(3, 4)), compare(f(2, 3), f(4, 6)),
      compare(f(3, 10), f(1, 4)), compare(f(4, 9), HALF),
    ],
  },
  "fraction:main-6": {
    entries: [
      calculate(f(1, 3), "+", f(1, 4)), calculate(f(1, 6), "+", HALF), estimate(f(3, 4), "+", HALF, ONE),
      plain(f(2, 3), "+", f(1, 4)), calculate(f(2, 5), "+", f(3, 10)),
    ],
  },
  "fraction:main-7": {
    entries: [
      calculate(f(5, 6), "-", f(1, 3)), calculate(HALF, "-", f(1, 5)), calculate(f(2, 3), "-", f(1, 4)),
      plain(f(3, 4), "-", f(1, 6)), calculate(f(7, 10), "-", f(1, 4)),
    ],
  },
  "fraction:main-8": {
    entries: [
      calculate(f(5, 4), "+", HALF, true), calculate(f(3, 2), "+", f(1, 3), true), calculate(f(5, 3), "-", HALF, true),
      calculate(f(7, 6), "+", f(2, 3), true), calculate(f(9, 4), "-", f(5, 6), true),
    ],
  },
  "fraction:test": {
    entries: [
      divide(4, 3), toDecimal(3, 5), equivalent(3, 5, 10),
      reduce(f(6, 9), HALF), common(f(1, 3), f(1, 4)), compare(f(3, 5), HALF),
      calculate(f(2, 3), "+", f(1, 6)), calculate(f(3, 4), "-", f(1, 3)), calculate(f(3, 2), "+", f(1, 4), true),
    ],
  },
  "fraction:fraction-t2": {
    tilesFirst: true,
    entries: [
      calculate(HALF, "+", f(1, 3)), calculate(HALF, "+", f(3, 4)), calculate(f(1, 3), "+", f(1, 6)),
      plain(f(1, 4), "+", f(1, 3)), calculate(f(1, 4), "+", f(1, 6)),
    ],
  },
  "fraction:fraction-t1": {
    entries: [
      reduce(f(9, 12), f(1, 3)), common(f(3, 4), f(1, 6)), common(f(5, 6), f(3, 4)),
      reduce(f(10, 12), f(1, 4)), common(f(2, 5), f(1, 3)),
    ],
  },
  "fraction:fraction-a": {
    entries: [
      estimate(f(3, 5), "+", f(2, 3), ONE), estimate(f(1, 5), "+", f(1, 4), ONE), estimate(f(5, 6), "+", f(1, 4), ONE),
      estimate(f(7, 8), "-", f(1, 3), HALF), estimate(f(1, 3), "+", f(1, 4), HALF),
    ],
  },
  "integer:main-0": { entries: [parity(14), parity(27), parity(0), parity(99), parity(50)] },
  "integer:main-1": { entries: [divisors(12), divisors(8), divisors(18), divisors(7), divisors(36)] },
  "integer:main-2": { entries: [multiples(3, 30), multiples(8, 36), multiples(6, 36), multiples(4, 20), multiples(9, 36)] },
  "integer:main-3": {
    entries: [commonDivisors(8, 12), commonDivisors(12, 18), gcd(16, 24), gcd(18, 27), gcd(30, 45)],
  },
  "integer:main-4": { entries: [commonMultiple(8, 12, 1), commonMultiple(8, 12, 2), lcm(4, 6), lcm(6, 9), lcm(10, 15)] },
  "integer:integer-t": { entries: [parity(63), divisors(20), multiples(7, 35), divisors(15), parity(48)] },
  "integer:test": { entries: [parity(35), divisors(16), multiples(5, 30), gcd(12, 20), lcm(9, 12)] },
  "decimal:main-0": {
    entries: [shift("3.14", 10), shift("0.52", 100), shift("2.5", 1000), shift("24.85", HUNDREDTH), shift("7.6", TENTH)],
  },
  "decimal:main-1": {
    entries: [
      compareProduct(80, "0.8"), compareProduct(80, "2.5"), compareProduct(12, "1.5"), compareProduct(45, "0.6"),
      compareProduct("3.6", "0.9"),
    ],
  },
  "decimal:main-2": {
    entries: [multiply(12, "4.3"), multiply(12, "0.43"), multiply("2.3", "1.4"), multiply("0.8", "0.6"), multiply("1.25", "0.4")],
  },
  "decimal:main-3": {
    entries: [
      compareQuotient(9, "1.8"), compareQuotient(80, "2.5"), compareQuotient(6, "0.4"), compareQuotient("4.8", "0.6"),
      compareQuotient(3, "0.5"),
    ],
  },
  "decimal:main-4": {
    entries: [
      divideDecimal("7.2", "2.4"), divideDecimal("0.1", "0.04"), divideDecimal("0.5", "0.4"), divideDecimal(9, "1.8"),
      divideDecimal("6.3", "0.9"),
    ],
  },
  "decimal:main-5": {
    entries: [
      divideRemainder("7.5", "2.3"), divideRemainder("5.2", "1.5"), divideRemainder("9.4", "2.2"),
      divideRemainder("6.5", "0.8"), divideRemainder("3.7", "1.2"),
    ],
  },
  "decimal:main-6": {
    entries: [
      distributive(30, 2, "0.5"), distributive(12, 4, "0.3"), distributive(25, 3, "0.4"), distributive(40, 1, "0.2"),
      distributive(16, 2, "0.5"),
    ],
  },
  "decimal:decimal-t": {
    entries: [shift("3.75", 100), multiply(15, "0.6"), compareProduct(50, "1.2"), multiply("3.4", "2.5"), shift("46.2", TENTH)],
  },
  "decimal:test": {
    entries: [
      shift("5.08", 10), compareProduct(60, "0.7"), multiply("2.6", "3.5"), compareQuotient(8, "0.5"),
      divideDecimal("8.4", "1.2"), divideRemainder("8.3", "2.5"), distributive(20, 3, "0.5"),
    ],
  },
  "expression:main-0": {
    entries: [
      pickRule("add", 2, 0), pickRule("mul", 2, 0), pickRule("mulAdd", 3, 1), pickRule("mul", 5, 0), pickRule("add", 7, 0),
    ],
  },
  "expression:main-1": {
    entries: [
      tableBlank("add", 2, 0, 5), tableBlank("mul", 3, 0, 4), tableBlank("mulAdd", 3, 1, 6), tableBlank("mulAdd", 2, 5, 3),
      tableBlank("mul", 6, 0, 7),
    ],
  },
  "expression:main-2": {
    entries: [
      evaluate("mul", 4, 0, "2.5"), evaluate("add", 3, 0, 8), evaluate("mulAdd", 2, 1, "1.5"), evaluate("mul", 3, 0, 10),
      evaluate("mulAdd", 4, 3, "0.5"),
    ],
  },
  "expression:expression-t": {
    entries: [
      pickRule("mul", 4, 0), tableBlank("add", 5, 0, 6), pickRule("mulAdd", 2, 3), tableBlank("mul", 7, 0, 3),
      tableBlank("mulAdd", 5, 2, 4),
    ],
  },
  "expression:test": {
    entries: [pickRule("mulAdd", 4, 1), tableBlank("mul", 8, 0, 5), evaluate("mulAdd", 3, 2, "2.5")],
  },
};
