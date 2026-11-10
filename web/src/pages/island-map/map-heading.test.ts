import { describe, expect, it } from "vitest";
import { COPY } from "../../copy";
import { dayWord, mapHeading } from "./map-heading";

// 月は 1 始まりで書く
const on = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe("島の地図の見出し（D-105）", () => {
  it("一言のあとに CP-001 を続ける", () => {
    expect(mapHeading(on(2026, 11, 10))).toBe(`${COPY.CP_019}。${COPY.CP_001}`);
  });

  it("決まった日は曜日より先に使う", () => {
    expect(dayWord(on(2027, 1, 1))).toBe(COPY.CP_010); // 金曜
    expect(dayWord(on(2026, 5, 5))).toBe(COPY.CP_011);
    expect(dayWord(on(2029, 7, 7))).toBe(COPY.CP_012); // 土曜
  });

  it("月曜、金曜、土日は曜日の一言", () => {
    expect(dayWord(on(2026, 11, 9))).toBe(COPY.CP_013);
    expect(dayWord(on(2026, 11, 13))).toBe(COPY.CP_014);
    expect(dayWord(on(2026, 11, 8))).toBe(COPY.CP_015);
    expect(dayWord(on(2026, 11, 14))).toBe(COPY.CP_015);
  });

  it("火曜から木曜は季節の一言", () => {
    expect(dayWord(on(2026, 3, 3))).toBe(COPY.CP_016);
    expect(dayWord(on(2026, 5, 27))).toBe(COPY.CP_016);
    expect(dayWord(on(2026, 6, 2))).toBe(COPY.CP_017);
    expect(dayWord(on(2026, 7, 1))).toBe(COPY.CP_018);
    expect(dayWord(on(2026, 8, 26))).toBe(COPY.CP_018);
    expect(dayWord(on(2026, 9, 1))).toBe(COPY.CP_019);
    expect(dayWord(on(2026, 11, 10))).toBe(COPY.CP_019);
    expect(dayWord(on(2026, 12, 1))).toBe(COPY.CP_020);
    expect(dayWord(on(2027, 2, 2))).toBe(COPY.CP_020);
  });
});
