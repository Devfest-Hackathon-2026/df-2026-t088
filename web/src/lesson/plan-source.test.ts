import { beforeEach, describe, expect, it } from "vitest";
import { currentPlanOverrides, initPlanOverrides, loadPlanOverrides, resetPlanOverrides, sanitizeOverrides } from "./plan-source";

describe("sanitizeOverrides", () => {
  it("オブジェクトでない値は {}", () => {
    for (const value of [null, undefined, [], "text", 3, true]) expect(sanitizeOverrides(value)).toEqual({});
  });

  it("配列でない学習は捨て、形の違う行は捨てる", () => {
    const good = { maker: "fraction.reduce", args: [{ num: 4, den: 6 }, { num: 1, den: 2 }] };
    expect(sanitizeOverrides({
      "fraction:main-3": [good, { maker: 3, args: [] }, { maker: "fraction.reduce", args: "x" }, null, "row", { args: [] }],
      "fraction:main-4": "text",
      "fraction:main-5": { maker: "fraction.compare", args: [] },
    })).toEqual({ "fraction:main-3": [good] });
  });

  it("余分な項目は落とす", () => {
    expect(sanitizeOverrides({ a: [{ maker: "m", args: [], extra: 1 }] })).toEqual({ a: [{ maker: "m", args: [] }] });
  });
});

describe("loadPlanOverrides と覚える口", () => {
  beforeEach(resetPlanOverrides);

  it("今は {} を返す", async () => {
    await expect(loadPlanOverrides()).resolves.toEqual({});
  });

  it("読む前は {}。起動で1回読んで覚え、同じオブジェクトを返す", async () => {
    const before = currentPlanOverrides();
    expect(before).toEqual({});
    const first = initPlanOverrides();
    expect(initPlanOverrides()).toBe(first);
    await first;
    expect(currentPlanOverrides()).toEqual({});
    expect(currentPlanOverrides()).toBe(currentPlanOverrides());
  });
});
