import { describe, expect, it } from "vitest";
import { parseColor, parseColorParts } from "./color";

describe("parseColorParts", () => {
  it("rgb(r g b / a) を読む", () => {
    expect(parseColorParts("rgb(20 80 111 / 0.34)")).toEqual({ r: 20, g: 80, b: 111, alpha: 0.34 });
  });
  it("rgb の % の透明度を読む", () => {
    expect(parseColorParts("rgb(20 80 111 / 34%)")?.alpha).toBeCloseTo(0.34);
  });
  it("#rrggbbaa を色と透明度に分ける（ビルドの圧縮が出す形）", () => {
    const p = parseColorParts("#14506f57")!;
    expect([p.r, p.g, p.b]).toEqual([0x14, 0x50, 0x6f]);
    expect(p.alpha).toBeCloseTo(0x57 / 255);
  });
  it("#rgba を読む", () => {
    expect(parseColorParts("#f08c")).toEqual({ r: 255, g: 0, b: 136, alpha: 0xcc / 255 });
  });
  it("#rrggbb の透明度は 1", () => {
    expect(parseColorParts("#3a4a6b")).toEqual({ r: 0x3a, g: 0x4a, b: 0x6b, alpha: 1 });
  });
  it("#rgb の透明度は 1", () => {
    expect(parseColorParts("#fff")).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
  });
  it("読めない文字は null", () => {
    expect(parseColorParts("#12345")).toBeNull();
  });
});

describe("parseColor", () => {
  it("rgb() と同じ色の #rrggbbaa は、同じ色と透明度になる", () => {
    const a = parseColor("rgb(58 74 107 / 0.62)");
    const b = parseColor("#3a4a6b9e");
    expect(b.color.getHex()).toBe(a.color.getHex());
    expect(b.alpha).toBeCloseTo(a.alpha, 2);
    expect(b.color.getHex()).not.toBe(0xffffff);
  });
  it("#rrggbb は THREE.Color の読みと同じ", () => {
    expect(parseColor("#3a4a6b").color.getHex()).toBe(0x3a4a6b);
    expect(parseColor("#3a4a6b").alpha).toBe(1);
  });
});
