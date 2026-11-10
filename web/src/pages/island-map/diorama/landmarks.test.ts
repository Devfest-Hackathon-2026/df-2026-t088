import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SUBJECTS, subjectsOfGrade, type SubjectId } from "../../../data";
import { GRADES } from "../../../data/kanji-grades";
import { buildLandmarks, type LandmarkColors } from "./landmarks";
import { getIslandLayout, ISLAND_SEED, layerCount, summitY } from "./layout";
import { islandLayerOutline } from "./terrain";

const IDS: SubjectId[] = SUBJECTS.map((s) => s.id);
const colors = new Proxy({} as LandmarkColors, { get: () => new THREE.Color(0.5, 0.5, 0.5) });

/** 消したヤシ 15 本の三角形（幹 28 + 葉 16 × 6 = 124 本あたり）と、高原を足した実測の残り（30,000 − 28,974） */
const PALM_TRIANGLES = 124 * 15;
const BUDGET = PALM_TRIANGLES + (30_000 - 28_974);

/** 頂上の段の輪郭の内側か（島の中心からの位置、広い画面の半径） */
const insideTop = (id: SubjectId, px: number, pz: number) => {
  const wideR = getIslandLayout("wide").find((q) => q.id === id)!.radius;
  const outline = islandLayerOutline(ISLAND_SEED[id], wideR, layerCount(id) - 1, layerCount(id));
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i];
    const [xj, zj] = outline[j];
    if (zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

describe("教科の飾りの形", () => {
  it("10 教科すべての島に作り、島の形と結合できる属性を持つ", () => {
    expect(IDS).toHaveLength(10);
    for (const id of IDS) {
      const g = buildLandmarks(id, colors)!;
      expect(g).not.toBeNull();
      expect(g.index).toBeNull();
      for (const name of ["position", "normal", "uv", "color"]) expect(g.getAttribute(name)).toBeDefined();
      g.dispose();
    }
  });

  it("頂上の面に乗り、面の外へはみ出さない", () => {
    for (const id of IDS) {
      const g = buildLandmarks(id, colors)!;
      const pos = g.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        expect(pos.getY(i), `${id} の頂点 ${i}`).toBeGreaterThanOrEqual(summitY(id) - 1e-3);
        expect(insideTop(id, pos.getX(i), pos.getZ(i)), `${id} の頂点 ${i}`).toBe(true);
      }
      g.dispose();
    }
  });

  it("三角形の数が、消したヤシの分と上限（3 万個）の残りに収まる。数えるのは、学年ごとに同時に出す島（FR-002）", () => {
    const triangles = new Map<SubjectId, number>();
    for (const id of IDS) {
      const g = buildLandmarks(id, colors)!;
      triangles.set(id, g.getAttribute("position").count / 3);
      g.dispose();
    }
    // 生活は1・2年だけ、理科・社会・英語・家庭は3年以上なので、全部を同時に出すことは無い
    const worst = Math.max(...GRADES.map((grade) => subjectsOfGrade(grade).reduce((sum, id) => sum + (triangles.get(id) ?? 0), 0)));
    console.info(`教科の飾りの三角形（いちばん多い学年）: ${worst}（上限 ${BUDGET}）`);
    expect(worst).toBeLessThanOrEqual(BUDGET);
  });
});
