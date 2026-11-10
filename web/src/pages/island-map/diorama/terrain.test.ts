import { describe, expect, it } from "vitest";
import { islandLayerOutline, wobblyOutline } from "./terrain";

describe("wobblyOutline", () => {
  it("同じ種なら同じ点列", () => {
    expect(wobblyOutline(7, 3, 2)).toEqual(wobblyOutline(7, 3, 2));
  });
  it("違う種なら違う点列", () => {
    expect(wobblyOutline(7, 3, 2)).not.toEqual(wobblyOutline(8, 3, 2));
  });
  it("点の数と半径の範囲", () => {
    const pts = wobblyOutline(1, 4, 4, { points: 32, rough: 0.1 });
    expect(pts).toHaveLength(32);
    for (const [x, z] of pts) expect(Math.hypot(x, z)).toBeLessThan(4 * 1.25);
  });
});

describe("角の丸い四角", () => {
  it("exponent を上げると四隅が外へ出る", () => {
    const max = (p: [number, number][]) => Math.max(...p.map(([x, z]) => Math.hypot(x, z)));
    expect(max(wobblyOutline(1, 4, 4, { rough: 0, exponent: 4 }))).toBeGreaterThan(max(wobblyOutline(1, 4, 4, { rough: 0 })) * 1.1);
  });
});

describe("islandLayerOutline", () => {
  it("上の段ほど小さく、輪郭も変わる", () => {
    const area = (p: [number, number][]) =>
      Math.abs(p.reduce((s, [x, z], i) => s + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * z, 0)) / 2;
    const low = islandLayerOutline(3, 3, 0, 4);
    const top = islandLayerOutline(3, 3, 3, 4);
    expect(area(top)).toBeLessThan(area(low));
    expect(top).not.toEqual(low);
    expect(islandLayerOutline(3, 3, 1, 4)).toEqual(islandLayerOutline(3, 3, 1, 4));
  });
});
