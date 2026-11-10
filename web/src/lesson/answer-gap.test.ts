import { describe, expect, it } from "vitest";
import { answerGap, GAP_EXTRA_WHOLES } from "./answer-gap";
import { calculateProblem, compareProblem, reduceProblem } from "./problems";
import type { LessonDefinition } from "./problems";
import { createSession, submitAnswer, submitChoice, typeAnswer } from "./session";
import type { LessonSession } from "./session";

const f = (num: number, den: number) => ({ num, den });

const lessonOf = (problem: LessonDefinition["problems"][number]): LessonDefinition => ({ id: "fixture", isTilesFirst: false, problems: [problem] });

const answered = (lesson: LessonDefinition, text: string): LessonSession => submitAnswer(typeAnswer(createSession(lesson), text));

const ADD = lessonOf(calculateProblem(f(1, 2), "+", f(1, 3)));

describe("まちがえた答えのずれ", () => {
  it("小さい答えは short、大きい答えは long。問題の大きさは 1 までの目盛りで見せる", () => {
    expect(answered(ADD, "2/5")).toMatchObject({ message: "wrongToTiles" });
    expect(answerGap(answered(ADD, "2/5"))).toEqual({ answer: f(2, 5), expected: f(5, 6), wholes: 1, isClipped: false, direction: "short" });
    expect(answerGap(answered(ADD, "1"))).toMatchObject({ direction: "long", wholes: 1, isClipped: false });
  });

  it("1 を超える答えは、答えの整数まで目盛りを伸ばす", () => {
    expect(answerGap(answered(ADD, "2/1"))).toMatchObject({ wholes: 2, isClipped: false });
    expect(answerGap(answered(ADD, "3/2"))).toMatchObject({ wholes: 2, isClipped: false });
  });

  it("大きすぎる答えは、問題の大きさから決まった数の整数で切る", () => {
    const gap = answerGap(answered(ADD, "99/2"));
    expect(gap).toMatchObject({ wholes: 1 + GAP_EXTRA_WHOLES, isClipped: true, direction: "long" });
  });

  it("0 と答えても図にできる", () => {
    expect(answerGap(answered(ADD, "0"))).toMatchObject({ answer: f(0, 1), direction: "short" });
  });

  it("正解、空欄、読めない答えは図にしない", () => {
    expect(answerGap(answered(ADD, "5/6"))).toBeNull();
    expect(answerGap(answered(ADD, ""))).toBeNull();
    expect(answerGap(answered(ADD, "わからない"))).toBeNull();
    expect(answerGap(createSession(ADD))).toBeNull();
  });

  it("約分で、同じ大きさのまま約分が足りない答えは図にしない。値がちがえば図にする", () => {
    const reduce = lessonOf(reduceProblem(f(4, 6), f(1, 6)));
    expect(answered(reduce, "4/6").message).toBe("notLowest");
    expect(answerGap(answered(reduce, "4/6"))).toBeNull();
    expect(answerGap(answered(reduce, "1/3"))).toMatchObject({ expected: f(2, 3), direction: "short" });
  });

  it("選ぶ問題は分数を答えないので、図にしない", () => {
    const compare = lessonOf(compareProblem(f(1, 2), f(1, 3)));
    expect(answerGap(submitChoice(createSession(compare), "right"))).toBeNull();
  });
});
