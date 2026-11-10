import { describe, expect, it } from "vitest";
import { parseCubicBezier, parseDuration } from "./easing";

describe("parseCubicBezier", () => {
  const zoom = parseCubicBezier("cubic-bezier(0.6, -0.3, 0.2, 1)")!;

  it("始点 0、終点 1", () => {
    expect(zoom(0)).toBe(0);
    expect(zoom(1)).toBe(1);
  });
  it("--ease-zoom は進み度 0.157 付近で負になる", () => {
    expect(zoom(0.157)).toBeLessThan(0);
  });
  it("終わりに近づくと 1 へ向かう", () => {
    expect(zoom(0.95)).toBeGreaterThan(0.9);
  });
  it("ease-out は単調に増える", () => {
    const out = parseCubicBezier("cubic-bezier(0.23, 1, 0.32, 1)")!;
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const y = out(i / 20);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(out(0.5)).toBeGreaterThan(0.5);
  });
  it("解析できない文字は null", () => {
    expect(parseCubicBezier("ease")).toBeNull();
  });
});

describe("parseDuration", () => {
  it("ms と s を読む", () => {
    expect(parseDuration("1200ms")).toBe(1200);
    expect(parseDuration("1.2s")).toBe(1200);
    expect(parseDuration("abc")).toBeNull();
  });
});
