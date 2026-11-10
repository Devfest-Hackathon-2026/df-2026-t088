import test from "node:test";
import assert from "node:assert/strict";
import { createLoopStore } from "./store.ts";
import type { AfterHint, Stumble } from "./store.ts";

const stumble = (problem: string): Stumble => ({
  chapterId: "fraction", lessonKey: "main-6", problem, hintsShown: 0, pattern: "unclassified", source: "demo", occurredOn: "2026-11-08",
});

const afterHint = (problem: string): AfterHint => ({
  lessonKey: "main-6", problem, pattern: "sum-both", hintVersion: "base", next: "same", source: "demo", occurredOn: "2026-11-08",
});

test("記録 store が満杯なら古いものから入れ替える", () => {
  const store = createLoopStore({ capacity: 5 });
  for (let index = 0; index < 6; index += 1) assert.equal(store.addStumble({ ...stumble("1/2+1/3"), hintsShown: index }), true);
  assert.deepEqual(store.records().map((record) => record.hintsShown), [1, 2, 3, 4, 5]);

  for (let index = 0; index < 5; index += 1) assert.equal(store.addAfterHint(afterHint("1/2+1/3")), true);
  assert.equal(store.addAfterHint({ ...afterHint("1/2+1/3"), next: "correct" }), true);
  assert.deepEqual(store.hintEffect().cells, [{
    lessonKey: "main-6", problem: "1/2+1/3", pattern: "sum-both", hintVersion: "base", count: 5, correct: 1, same: 4, other: 0,
  }]);
});

test("デモの記録は、demoMinimum を設定したときだけ少ない件数から出す。見本が混ざれば 5 件の決まりに戻る", () => {
  const demo: Stumble = { ...stumble("左2-30g-右3"), lessonKey: "print:rika-lever", chapterId: "rika", pattern: "lever-same-weight" };
  const byDefault = createLoopStore();
  byDefault.addStumble(demo);
  assert.equal(byDefault.summary().length, 0);
  assert.equal(byDefault.patternVisible(demo.lessonKey, demo.problem, "lever-same-weight"), false);

  const forDemo = createLoopStore({ demoMinimum: 1 });
  forDemo.addStumble(demo);
  assert.deepEqual(forDemo.summary().map((entry) => [entry.problem, entry.count, entry.patterns]), [["左2-30g-右3", 1, [{ pattern: "lever-same-weight", count: 1 }]]]);
  assert.equal(forDemo.patternVisible(demo.lessonKey, demo.problem, "lever-same-weight"), true);

  forDemo.addStumble({ ...demo, source: "dummy" });
  assert.equal(forDemo.summary().length, 0);
  assert.equal(forDemo.patternVisible(demo.lessonKey, demo.problem, "lever-same-weight"), false);
});

test("demoMinimum は 1〜5 に収める（5 より大きくしても 5、0 以下は 1）", () => {
  const demo: Stumble = { ...stumble("1/2+1/3"), pattern: "sum-both" };
  const loose = createLoopStore({ demoMinimum: 0 });
  loose.addStumble(demo);
  assert.equal(loose.summary().length, 1);
  const strict = createLoopStore({ demoMinimum: 99 });
  for (let index = 0; index < 4; index += 1) strict.addStumble(demo);
  assert.equal(strict.summary().length, 0);
  strict.addStumble(demo);
  assert.equal(strict.summary().length, 1);
});
