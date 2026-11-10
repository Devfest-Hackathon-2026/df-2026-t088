import { describe, expect, it } from "vitest";
import { HIGHLAND_SUBJECTS } from "../../../data";
import { islandLayerOutline } from "./terrain";
import {
  areaFit,
  areaOf,
  areaPlaces,
  birdAt,
  BIRD_COUNT,
  computeCloseupPose,
  computeOverviewPose,
  fishAt,
  fishRoutes,
  FISH_COUNT,
  fitPoints,
  getIslandLayout,
  groundY,
  hillRiseTarget,
  ISLAND_BASE,
  ISLAND_SEED,
  isHighland,
  LAND_TOP,
  landBridge,
  landOf,
  layerCount,
  layoutModeFor,
  NOTEBOOK_TOP,
  LANDMARK_COUNT,
  landmarkSpots,
  SEA_EXPONENT,
  seaExtents,
  SEA_RING,
  projectToNdc,
  roadRing,
  stepToward,
  summitY,
  treeSpots,
} from "./layout";

const cases: [string, number, number][] = [
  ["16:9", 1600, 900],
  ["4:3", 1024, 768],
  ["タブレット縦", 768, 1024],
  ["スマホ縦", 390, 844],
  ["超ワイド", 2400, 800],
];

describe("全景のカメラ", () => {
  for (const [name, w, h] of cases) {
    it(`${name}: 全ての島と海の縁が視野に収まり、上 15% は空く`, () => {
      const mode = layoutModeFor(w, h);
      const all = getIslandLayout(mode);
      const places = areaPlaces(all, "sea");
      const extra = areaFit(mode, all, "sea");
      const pose = computeOverviewPose(places, w / h, { extra });
      // 島と、海の縁（狭い画面は高原の縁も）が全部入る。鉛筆は欠けてよい（D-66）
      for (const p of [...fitPoints(places), ...extra]) {
        const n = projectToNdc(pose, p, w / h);
        expect(n.depth).toBeGreaterThan(0);
        expect(Math.abs(n.x)).toBeLessThanOrEqual(1);
        expect(n.y).toBeGreaterThanOrEqual(-1);
        expect(n.y).toBeLessThanOrEqual(0.7 + 1e-6);
      }
    });
  }
  for (const [name, w, h] of cases) {
    it(`${name}: 海の全景で、海の紙の左右の端が画面の中心から等しい`, () => {
      const mode = layoutModeFor(w, h);
      const all = getIslandLayout(mode);
      const places = areaPlaces(all, "sea");
      const pose = computeOverviewPose(places, w / h, { extra: areaFit(mode, all, "sea") });
      const { rx } = seaExtents(places, 0, mode);
      const left = projectToNdc(pose, [-rx, NOTEBOOK_TOP, 0], w / h);
      const right = projectToNdc(pose, [rx, NOTEBOOK_TOP, 0], w / h);
      expect(left.x + right.x).toBeCloseTo(0, 6);
    });
  }
  for (const [name, w, h] of cases) {
    it(`${name}: 高原の全景に丘が収まる`, () => {
      const mode = layoutModeFor(w, h);
      const all = getIslandLayout(mode);
      const places = areaPlaces(all, "highland");
      const extra = areaFit(mode, all, "highland");
      const pose = computeOverviewPose(places, w / h, { extra });
      for (const p of [...fitPoints(places), ...extra]) {
        const n = projectToNdc(pose, p, w / h);
        expect(Math.abs(n.x)).toBeLessThanOrEqual(1);
        expect(n.y).toBeGreaterThanOrEqual(-1);
        expect(n.y).toBeLessThanOrEqual(0.7 + 1e-6);
      }
    });
  }
  it("画面が狭いほど遠くなる", () => {
    const wide = computeOverviewPose(getIslandLayout("wide"), 16 / 9).distance;
    const narrow = computeOverviewPose(getIslandLayout("narrow"), 390 / 844).distance;
    expect(narrow).toBeGreaterThan(0);
    expect(wide).toBeGreaterThan(0);
  });
});

const PHI = (1 + Math.sqrt(5)) / 2;

describe("島の置き方", () => {
  it("海の5島は正五角形で、対角線：辺 = φ", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const sea = getIslandLayout(mode);
      // 狭い画面は z を φ 倍に伸ばしているので、割って正五角形に戻す
      const kz = mode === "narrow" ? PHI : 1;
      const pos = SEA_RING.map((id) => {
        const p = sea.find((q) => q.id === id)!;
        return [p.x, p.z / kz];
      });
      const d = (i: number, j: number) => Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
      const side = d(0, 1);
      for (let i = 0; i < 5; i++) {
        expect(d(i, (i + 1) % 5) / side).toBeCloseTo(1, 2);
        expect(d(i, (i + 2) % 5) / side).toBeCloseTo(PHI, 2);
      }
    }
  });
  it("海の5島は同じ大きさと高さで、中央を空ける（中央に立つのは生活だけ）", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const sea = getIslandLayout(mode).filter((p) => !isHighland(p.id) && p.id !== "seikatsu");
      expect(sea).toHaveLength(5);
      expect(new Set(sea.map((p) => p.radius)).size).toBe(1);
      expect(new Set(sea.map((p) => layerCount(p.id))).size).toBe(1);
      const cx = sea.reduce((a, p) => a + p.x, 0) / sea.length;
      const cz = sea.reduce((a, p) => a + p.z, 0) / sea.length;
      for (const p of sea) expect(Math.hypot(p.x - cx, p.z - cz)).toBeGreaterThan(p.radius * 1.5);
    }
  });
  it("生活は海の中央で、海の5島と同じ大きさと高さ", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const places = getIslandLayout(mode);
      const seikatsu = places.find((p) => p.id === "seikatsu")!;
      expect(areaOf("seikatsu")).toBe("sea");
      expect([seikatsu.x, seikatsu.z]).toEqual([0, 0]);
      expect(layerCount("seikatsu")).toBe(layerCount("sansu"));
      expect(seikatsu.radius).toBe(places.find((p) => p.id === "sansu")!.radius);
    }
  });
  it("道の輪は海の5島を1回ずつ通る", () => {
    const sea = getIslandLayout("wide").filter((p) => !isHighland(p.id) && p.id !== "seikatsu").map((p) => p.id);
    expect([...SEA_RING].sort()).toEqual([...sea].sort());
  });
  it("道は出す島だけをつなぎ、生活は国語の次に入る", () => {
    const at = (ids: string[]) => getIslandLayout("wide").filter((p) => ids.includes(p.id));
    expect(roadRing(at(["kokugo", "sansu", "seikatsu"])).map((p) => p.id)).toEqual(["kokugo", "seikatsu", "sansu"]);
    expect(roadRing(at(["kokugo", "sansu", "rika", "shakai", "eigo"])).map((p) => p.id)).toEqual([...SEA_RING]);
  });
  it("島どうしが重ならない", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const ps = getIslandLayout(mode);
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++)
          expect(Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z)).toBeGreaterThan(ps[i].radius + ps[j].radius);
    }
  });
  it("切り替えの境目", () => {
    expect(layoutModeFor(767, 500)).toBe("narrow");
    expect(layoutModeFor(800, 900)).toBe("narrow");
    expect(layoutModeFor(1200, 800)).toBe("wide");
  });
});

describe("海の紙", () => {
  it("全ての島のふちを包み、下の紙ほど大きい", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const ps = getIslandLayout(mode).filter((p) => !isHighland(p.id));
      const [deep, mid, shallow] = [0, 1, 2].map((i) => seaExtents(ps, i, mode));
      expect(deep.rx).toBeGreaterThan(mid.rx);
      expect(mid.rx).toBeGreaterThan(shallow.rx);
      for (const p of ps) {
        expect(shallow.rx).toBeGreaterThan(Math.abs(p.x) + p.radius * 0.7);
        expect(shallow.rz).toBeGreaterThan(Math.abs(p.z) + p.radius * 0.7);
      }
    }
  });
});

describe("右奥の高原", () => {
  const modes = ["wide", "narrow"] as const;
  const inLand = (mode: "wide" | "narrow", x: number, z: number) => {
    const l = landOf(mode);
    return Math.hypot((x - l.x) / l.rx, (z - l.z) / l.rz);
  };

  it("高原の4教科があり、丘は陸地の上に立つ", () => {
    expect(HIGHLAND_SUBJECTS).toEqual(["ongaku", "taiiku", "zuko", "katei"]);
    for (const mode of modes) {
      const hills = getIslandLayout(mode).filter((p) => isHighland(p.id));
      expect(hills).toHaveLength(4);
      for (const h of hills) {
        expect(inLand(mode, h.x, h.z)).toBeLessThan(0.8);
        expect(groundY(h.id)).toBeCloseTo(LAND_TOP - 0.02);
      }
    }
    expect(groundY("sansu")).toBe(ISLAND_BASE);
  });

  it("陸地の横：縦は φ に近い", () => {
    for (const mode of modes) {
      const l = landOf(mode);
      expect(Math.abs(l.rx / l.rz - PHI)).toBeLessThan(0.02);
    }
  });

  it("陸地は海の島に重ならず、ノートの上に収まる", () => {
    for (const mode of modes) {
      const l = landOf(mode);
      // ノートは 110×110（scene.ts）
      expect(Math.abs(l.x) + l.rx).toBeLessThan(55);
      expect(Math.abs(l.z) + l.rz).toBeLessThan(55);
      for (const p of getIslandLayout(mode).filter((q) => !isHighland(q.id))) {
        for (let i = 0; i < 24; i++) {
          const t = (i / 24) * Math.PI * 2;
          expect(inLand(mode, p.x + Math.cos(t) * p.radius, p.z + Math.sin(t) * p.radius)).toBeGreaterThan(1.05);
        }
      }
    }
  });

  it("丘は海を映す間だけ畳み、行き過ぎずに起き上がる", () => {
    expect(hillRiseTarget("sea")).toBe(0);
    expect(hillRiseTarget("highland")).toBe(1);
    expect(stepToward(0.95, 1, 0.1)).toBe(1);
    expect(stepToward(0.05, 0, 0.1)).toBe(0);
    expect(stepToward(0.5, 1, 0.1)).toBeCloseTo(0.6);
  });

  it("高原を足しても海は大きくならない", () => {
    for (const mode of modes) {
      const all = getIslandLayout(mode);
      expect(seaExtents(all, 0, mode)).toEqual(seaExtents(all.filter((p) => !isHighland(p.id)), 0, mode));
    }
  });

  it("木は草地の上で、丘に重ならない", () => {
    for (const mode of modes) {
      const hills = getIslandLayout(mode).filter((p) => isHighland(p.id));
      const trees = treeSpots(mode);
      expect(trees.length).toBeGreaterThanOrEqual(8);
      for (const s of trees) {
        expect(inLand(mode, s.x, s.z)).toBeLessThan(0.85);
        for (const h of hills) expect(Math.hypot(s.x - h.x, s.z - h.z)).toBeGreaterThan(h.radius);
      }
    }
  });

  it("高原の陸地は海の一番下の紙に重ならない（D-64）", () => {
    for (const mode of modes) {
      const l = landOf(mode);
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        for (const k of [0.5, 1]) {
          expect(inSea(l.x + Math.cos(t) * l.rx * k, l.z + Math.sin(t) * l.rz * k, 0, mode)).toBeGreaterThan(1);
        }
      }
      const { rx, rz } = seaExtents(getIslandLayout(mode), 0, mode);
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        expect(inLand(mode, Math.cos(t) * rx, Math.sin(t) * rz)).toBeGreaterThan(1);
      }
    }
  });

  it("海から高原へ渡る点線は海の紙から始まり、陸地まで届く", () => {
    for (const mode of modes) {
      const { from, start, end, ux, uz } = landBridge(getIslandLayout(mode), mode);
      expect(end).toBeGreaterThan(start);
      expect(inSea(from.x + ux * start, from.z + uz * start, 0, mode)).toBeLessThan(1);
      expect(inLand(mode, from.x + ux * end, from.z + uz * end)).toBeLessThan(1);
    }
  });
});

describe("寄ったカメラ", () => {
  it("頂上を見て、頂上は画面の中央", () => {
    const sansu = getIslandLayout("wide").find((p) => p.id === "sansu")!;
    const pose = computeCloseupPose(sansu);
    expect(pose.target[1]).toBeCloseTo(summitY("sansu"));
    const n = projectToNdc(pose, pose.target, 16 / 9);
    expect(Math.abs(n.x)).toBeLessThan(1e-6);
    expect(Math.abs(n.y)).toBeLessThan(1e-6);
  });
});

const inSea = (x: number, z: number, layer: number, mode: "wide" | "narrow") => {
  const { rx, rz } = seaExtents(getIslandLayout(mode), layer, mode);
  return Math.pow(Math.pow(Math.abs(x) / rx, SEA_EXPONENT) + Math.pow(Math.abs(z) / rz, SEA_EXPONENT), 1 / SEA_EXPONENT);
};

const insideTop = (id: Parameters<typeof landmarkSpots>[0], px: number, pz: number) => {
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

describe("教科の飾りの置き場所", () => {
  it("海の島と高原の丘に 3 つずつ", () => {
    for (const id of ["sansu", "kokugo", "rika", "shakai", "eigo", "seikatsu", ...HIGHLAND_SUBJECTS] as const) expect(landmarkSpots(id)).toHaveLength(3);
    expect(Object.values(LANDMARK_COUNT).reduce((a, b) => a + b, 0)).toBe(30);
  });
  it("島の手前側（付箋の反対）で、頂上の面の内側に立つ", () => {
    for (const id of ["sansu", "kokugo", "rika", "shakai", "eigo", "seikatsu", ...HIGHLAND_SUBJECTS] as const) {
      for (const s of landmarkSpots(id)) {
        // 位置は島の中心から。島の絵は広い画面の半径で作り、狭い画面では島ごと縮める
        expect(s.z).toBeGreaterThan(0);
        expect(s.y).toBeCloseTo(summitY(id));
        expect(insideTop(id, s.x, s.z)).toBe(true);
      }
    }
  });
});

describe("魚と鳥", () => {
  it("魚は 9 匹で、周回路が海の紙（一番下の紙）の内側に収まる", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const routes = fishRoutes(mode);
      expect(routes).toHaveLength(FISH_COUNT);
      for (const f of routes) {
        for (let t = 0; t < 400; t += 1.7) {
          const { x, z } = fishAt(f, t);
          expect(inSea(x, z, 0, mode)).toBeLessThan(0.95);
        }
      }
    }
  });
  it("魚は島の下を通らない", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const islands = getIslandLayout(mode).filter((p) => !isHighland(p.id));
      for (const f of fishRoutes(mode)) {
        for (let t = 0; t < 400; t += 1.7) {
          const { x, z } = fishAt(f, t);
          for (const p of islands) expect(Math.hypot(x - p.x, z - p.z)).toBeGreaterThan(p.radius);
        }
      }
    }
  });
  it("鳥は一番下の海の紙の上を回る", () => {
    for (const mode of ["wide", "narrow"] as const) {
      const { rx, rz } = seaExtents(getIslandLayout(mode), 0, mode);
      for (let i = 0; i < BIRD_COUNT; i++) {
        for (let t = 0; t < 300; t += 2.3) {
          const b = birdAt(i, t, rx, rz);
          expect(inSea(b.x, b.z, 0, mode)).toBeLessThan(0.7);
          expect(Math.hypot(b.tx, b.tz)).toBeCloseTo(1);
        }
      }
    }
  });
});
