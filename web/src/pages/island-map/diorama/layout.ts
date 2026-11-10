// 島の置き場所とカメラの計算。three には依存しない
import { HIGHLAND_SUBJECTS } from "../../../data";
import type { SubjectId } from "../../../data";
import { createRng } from "./terrain";

export type Vec3 = [number, number, number];
export interface Pose {
  position: Vec3;
  target: Vec3;
}

export type LayoutMode = "wide" | "narrow";

/** 紙 1 段の厚みと、海の紙の上面の高さ（世界の床 y=0 が机の面） */
export const LAYER_THICKNESS = 0.3;
export const NOTEBOOK_TOP = 0.1;
export const SEA_THICKNESS = 0.12;
export const SEA_TOP = NOTEBOOK_TOP + SEA_THICKNESS * 3;
export const ISLAND_BASE = SEA_TOP - 0.02;
/** 付箋が頂上の上に出る分（世界の長さ） */
export const STICKY_RISE = 1.8;

/** 右奥の高原の紙。下から砂、低い草地、草地の 3 枚を、上ほど小さく重ねる */
export const LAND_THICKNESS = 0.2;
export const LAND_LAYERS = 3;
export const LAND_TOP = NOTEBOOK_TOP + LAND_THICKNESS * LAND_LAYERS;
export const LAND_INSETS = [0, 0.4, 0.8];
export const LAND_EXPONENT = 2.4;

export const isHighland = (id: SubjectId): boolean => HIGHLAND_SUBJECTS.includes(id);

/** 島の地図の場所。全景に映すのは片方だけで、押して移る（D-61） */
export type MapArea = "sea" | "highland";
export const areaOf = (id: SubjectId): MapArea => (isHighland(id) ? "highland" : "sea");

export const layerCount = (id: SubjectId): number => (isHighland(id) ? 3 : 4);
/** 島の一番下の段の高さ。高原の丘は草地の上に立つ */
export const groundY = (id: SubjectId): number => (isHighland(id) ? LAND_TOP - 0.02 : ISLAND_BASE);
export const summitY = (id: SubjectId): number => groundY(id) + layerCount(id) * LAYER_THICKNESS;

export interface IslandPlace {
  id: SubjectId;
  x: number;
  z: number;
  radius: number;
}

// 海の5島は同じ大きさの正五角形。中央に置くのは生活だけ（D-63）。比率は黄金比 φ で揃える（D-64）：
// 対角線：辺 = φ は正五角形の性質で、隣の島までの距離は島の半径の φ³ 倍（広い画面の設計値）。
// 狭い画面は縦長なので、z だけを φ 倍に伸ばしている。高原の丘は海の外の右奥（広い）か奥（狭い）に置く
const WIDE: IslandPlace[] = [
  { id: "kokugo", x: 0, z: -7.9, radius: 2.2 },
  { id: "sansu", x: -7.51, z: -2.44, radius: 2.2 },
  { id: "rika", x: 7.51, z: -2.44, radius: 2.2 },
  { id: "shakai", x: -4.64, z: 6.39, radius: 2.2 },
  { id: "eigo", x: 4.64, z: 6.39, radius: 2.2 },
  // 生活（1・2年だけ）は五角形の中央。ほかの5島は1・2年に出ないので、同時には並ばない
  { id: "seikatsu", x: 0, z: 0, radius: 2.2 },
  { id: "ongaku", x: 15.5, z: -17.5, radius: 1.6 },
  { id: "taiiku", x: 21, z: -18.5, radius: 1.6 },
  { id: "zuko", x: 17.2, z: -13.1, radius: 1.6 },
  { id: "katei", x: 23, z: -13.9, radius: 1.6 },
];
const NARROW: IslandPlace[] = [
  { id: "kokugo", x: 0, z: -6.8, radius: 2 },
  { id: "sansu", x: -3.99, z: -2.1, radius: 2 },
  { id: "rika", x: 3.99, z: -2.1, radius: 2 },
  { id: "shakai", x: -2.47, z: 5.5, radius: 2 },
  { id: "eigo", x: 2.47, z: 5.5, radius: 2 },
  { id: "seikatsu", x: 0, z: 0, radius: 2 },
  { id: "ongaku", x: -3.1, z: -22, radius: 1.3 },
  { id: "taiiku", x: 2.3, z: -22, radius: 1.3 },
  { id: "zuko", x: -2.3, z: -17.7, radius: 1.3 },
  { id: "katei", x: 3.1, z: -17.7, radius: 1.3 },
];

/** 高原の陸地（一番下の紙）。中心と半径。横：縦は φ に近い（D-64） */
export interface LandPlace {
  x: number;
  z: number;
  rx: number;
  rz: number;
}
const LAND: Record<LayoutMode, LandPlace> = {
  wide: { x: 19, z: -15.5, rx: 9.7, rz: 6 },
  narrow: { x: 0, z: -19.5, rx: 9, rz: 5.6 },
};
export const landOf = (mode: LayoutMode): LandPlace => ({ ...LAND[mode] });

export function getIslandLayout(mode: LayoutMode): IslandPlace[] {
  return (mode === "wide" ? WIDE : NARROW).map((p) => ({ ...p }));
}

/** 海の5島を道でつなぐ順。一周して国語へ戻る（D-63） */
export const SEA_RING: readonly SubjectId[] = ["kokugo", "rika", "eigo", "shakai", "sansu"];

/** 出す島だけを道でつなぐ順。生活（中央）は国語の次に入れ、中央を通って一周する */
export function roadRing<T extends { id: SubjectId }>(places: T[]): T[] {
  const ring = SEA_RING.map((id) => places.find((p) => p.id === id)).filter((p) => p !== undefined);
  const seikatsu = places.find((p) => p.id === "seikatsu");
  if (seikatsu) ring.splice(Math.min(1, ring.length), 0, seikatsu);
  return ring;
}

/** CSS 幅が 768 未満、または縦長なら狭い画面の置き方 */
export function layoutModeFor(width: number, height: number): LayoutMode {
  return width < 768 || height > width ? "narrow" : "wide";
}

/** 海の紙 3 枚（0 が一番下）の、島の外への張り出し。縁は角の丸い四角に近い形 */
export const SEA_PADS = [2.2, 1.5, 0.8];
export const SEA_EXPONENT = 3;

/** 海の紙の半径。全ての島のふちが入るようにする */
export function seaExtents(all: IslandPlace[], layer: number, mode: LayoutMode): { rx: number; rz: number } {
  // 高原の丘は海の外なので、海の大きさに数えない
  const places = all.filter((p) => !isHighland(p.id));
  // 狭い画面は横が足りないので、張り出しを小さくして島を大きく見せる
  const pad = SEA_PADS[layer] * (mode === "narrow" ? 0.4 : 1);
  let rx = Math.max(...places.map((p) => Math.abs(p.x) + p.radius)) + pad;
  let rz = Math.max(...places.map((p) => Math.abs(p.z) + p.radius)) + pad;
  let k = 0;
  for (const p of places) {
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      const x = Math.abs(p.x + Math.cos(t) * p.radius) / rx;
      const z = Math.abs(p.z + Math.sin(t) * p.radius) / rz;
      k = Math.max(k, Math.pow(Math.pow(x, SEA_EXPONENT) + Math.pow(z, SEA_EXPONENT), 1 / SEA_EXPONENT));
    }
  }
  k = Math.max(1, k * 1.08);
  rx *= k;
  rz *= k;
  // 下の紙が上の紙より小さくならないようにする
  if (layer < SEA_PADS.length - 1) {
    const inner = seaExtents(places, layer + 1, mode);
    const gap = (SEA_PADS[layer] - SEA_PADS[layer + 1]) * (mode === "narrow" ? 0.4 : 1);
    rx = Math.max(rx, inner.rx + gap);
    rz = Math.max(rz, inner.rz + gap);
  }
  return { rx, rz };
}

export interface NotebookProps {
  pencil: { x: number; z: number; rotY: number };
  /** 全景で画面に収めたい点（海の縁だけ。鉛筆は入れない D-64） */
  fit: Vec3[];
}

/** ノートの上の小道具の置き場所。広い画面は海の左に鉛筆。狭い画面は海の下に鉛筆 */
export function notebookProps(mode: LayoutMode, places: IslandPlace[]): NotebookProps {
  const { rx, rz } = seaExtents(places, 0, mode);
  const y = NOTEBOOK_TOP;
  const pencil =
    mode === "wide"
      ? { x: -rx - 1.2, z: 4, rotY: Math.PI / 2 + 0.1 }
      : { x: 1.2, z: rz + 1.5, rotY: 0.12 };
  const fit: Vec3[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const base = Math.pow(Math.pow(Math.abs(c), SEA_EXPONENT) + Math.pow(Math.abs(s), SEA_EXPONENT), -1 / SEA_EXPONENT);
    fit.push([c * base * rx, y, s * base * rz]);
  }
  return { pencil, fit };
}

const HIGHLAND_FIT_PAD = 1.4;

/** current を target へ step だけ近づける。行き過ぎない */
export const stepToward = (current: number, target: number, step: number): number =>
  current + Math.max(-step, Math.min(step, target - current));

/** 丘の起き上がり具合。海を映す間は畳んで草地の下に隠す（D-61） */
export const hillRiseTarget = (area: MapArea): number => (area === "highland" ? 1 : 0);

/** その場所の全景に映す島 */
export const areaPlaces = (places: IslandPlace[], area: MapArea): IslandPlace[] =>
  places.filter((p) => areaOf(p.id) === area);

/**
 * その場所の全景で、島のほかに収めたい点。海は海の縁（狭い画面は高原の縁も）、高原は丘のまわりの草地。
 * 鉛筆は入れない。入れると海の中心が左右にずれる（D-64）。海は全ての点を x で反転した点も入れて、中心を x=0 に固定する
 */
export function areaFit(mode: LayoutMode, places: IslandPlace[], area: MapArea): Vec3[] {
  if (area === "sea") {
    const fit = [...notebookProps(mode, areaPlaces(places, "sea")).fit];
    if (mode === "narrow") {
      // 縦長では高原が海のすぐ奥に続くので、高原の縁まで収める
      const land = landOf(mode);
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        fit.push([land.x + Math.cos(t) * land.rx, NOTEBOOK_TOP, land.z + Math.sin(t) * land.rz]);
      }
    }
    return [...fit, ...fit.map(([x, y, z]): Vec3 => [-x, y, z])];
  }
  const fit: Vec3[] = [];
  for (const p of areaPlaces(places, "highland")) {
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      const r = p.radius + HIGHLAND_FIT_PAD;
      fit.push([p.x + Math.cos(t) * r, LAND_TOP, p.z + Math.sin(t) * r]);
    }
  }
  return fit;
}

export const OVERVIEW_PITCH = 38;
export const CLOSEUP_PITCH = 24;
export const FOV = 35;
export const CLOSEUP_DISTANCE_RATIO = 1.6;

const rad = (d: number) => (d * Math.PI) / 180;

/** 見下ろし角から、カメラの前・右・上の向き（奥は -z） */
export function cameraBasis(pitchDeg: number): { f: Vec3; r: Vec3; u: Vec3 } {
  const p = rad(pitchDeg);
  return {
    f: [0, -Math.sin(p), -Math.cos(p)],
    r: [1, 0, 0],
    u: [0, Math.cos(p), -Math.sin(p)],
  };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 画面に収めたい点。島のふち、頂上の上の付箋の分 */
export function fitPoints(places: IslandPlace[]): Vec3[] {
  const pts: Vec3[] = [];
  for (const p of places) {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      pts.push([p.x + Math.cos(t) * p.radius, ISLAND_BASE, p.z + Math.sin(t) * p.radius]);
    }
    const top = summitY(p.id) + STICKY_RISE;
    pts.push([p.x - p.radius * 0.6, top, p.z], [p.x + p.radius * 0.6, top, p.z]);
  }
  return pts;
}

export interface FitOptions {
  fov?: number;
  pitch?: number;
  /** 画面の上のあけておく割合（見出し用） */
  topReserve?: number;
  /** 左右と下の余白（画面に対する割合） */
  margin?: number;
  /** 島のほかに収めたい点 */
  extra?: Vec3[];
}

/** 全景のカメラ。全ての点が収まる一番近い距離を二分法で探す */
export function computeOverviewPose(
  places: IslandPlace[],
  aspect: number,
  options: FitOptions = {},
): Pose & { distance: number } {
  const fov = options.fov ?? FOV;
  const pitch = options.pitch ?? OVERVIEW_PITCH;
  const topReserve = options.topReserve ?? 0.15;
  const margin = options.margin ?? 0.03;
  const { f, r, u } = cameraBasis(pitch);
  const ky = Math.tan(rad(fov / 2));
  const kx = ky * aspect;
  const pts = [...fitPoints(places), ...(options.extra ?? [])].map((p) => ({ x: dot(p, r), y: dot(p, u), z: dot(p, f) }));
  // 画面の NDC は -1〜1。上は topReserve*2 だけ空ける
  const yTop = 1 - topReserve * 2;
  const yBottom = 1 - margin * 2;
  const xLimit = 1 - margin * 2;

  const solve = (d: number) => {
    let aLo = -Infinity;
    let aHi = Infinity;
    let bLo = -Infinity;
    let bHi = Infinity;
    for (const p of pts) {
      const depth = p.z + d;
      if (depth <= 0.01) return null;
      aLo = Math.max(aLo, p.x - xLimit * kx * depth);
      aHi = Math.min(aHi, p.x + xLimit * kx * depth);
      bLo = Math.max(bLo, p.y - yTop * ky * depth);
      bHi = Math.min(bHi, p.y + yBottom * ky * depth);
    }
    if (aLo > aHi || bLo > bHi) return null;
    return { a: (aLo + aHi) / 2, b: (bLo + bHi) / 2 };
  };

  let lo = 1;
  let hi = 400;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (solve(mid)) hi = mid;
    else lo = mid;
  }
  const d = hi;
  const { a, b } = solve(d) ?? { a: 0, b: 0 };
  const target: Vec3 = [r[0] * a + u[0] * b, r[1] * a + u[1] * b, r[2] * a + u[2] * b];
  const position: Vec3 = [target[0] - f[0] * d, target[1] - f[1] * d, target[2] - f[2] * d];
  return { position, target, distance: d };
}

/** 島へ寄ったカメラ。頂上を見て、距離は島の幅の約 1.6 倍 */
export function computeCloseupPose(place: IslandPlace, pitch = CLOSEUP_PITCH): Pose {
  const { f } = cameraBasis(pitch);
  const d = place.radius * 2 * CLOSEUP_DISTANCE_RATIO;
  const target: Vec3 = [place.x, summitY(place.id), place.z];
  return { position: [target[0] - f[0] * d, target[1] - f[1] * d, target[2] - f[2] * d], target };
}

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** t は 0〜1 を出てよい（clamp しない） */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { position: lerpVec3(a.position, b.position, t), target: lerpVec3(a.target, b.target, t) };
}

/** 世界の点を NDC（-1〜1、上が +1）へ写す。テスト用にも使う */
export function projectToNdc(
  pose: Pose,
  point: Vec3,
  aspect: number,
  fov = FOV,
): { x: number; y: number; depth: number } {
  const fwd: Vec3 = [
    pose.target[0] - pose.position[0],
    pose.target[1] - pose.position[1],
    pose.target[2] - pose.position[2],
  ];
  const len = Math.hypot(...fwd);
  const f: Vec3 = [fwd[0] / len, fwd[1] / len, fwd[2] / len];
  // 右 = f × (0,1,0)
  const rx = -f[2];
  const rz = f[0];
  const rl = Math.hypot(rx, rz);
  const r: Vec3 = [rx / rl, 0, rz / rl];
  const u: Vec3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  // r × f が上になる向きに直す
  const up: Vec3 = u[1] < 0 ? [-u[0], -u[1], -u[2]] : u;
  const rel: Vec3 = [
    point[0] - pose.position[0],
    point[1] - pose.position[1],
    point[2] - pose.position[2],
  ];
  const depth = dot(rel, f);
  const ky = Math.tan(rad(fov / 2));
  return { x: dot(rel, r) / (depth * ky * aspect), y: dot(rel, up) / (depth * ky), depth };
}

// ---- 島の飾り（教科の飾り・魚・鳥）。置き場所と動きの計算だけ。three には依存しない ----

/** 島ごとの切り絵の種（絵と飾りの乱数をそろえる） */
export const ISLAND_SEED: Record<SubjectId, number> = {
  sansu: 11, kokugo: 23, rika: 37, shakai: 41, eigo: 53, ongaku: 61, taiiku: 67, zuko: 73, katei: 79, seikatsu: 83,
};

/** 教科の飾りの数：海の島にも高原の丘にも 3 つずつ（D-79）。生活も同じ */
export const LANDMARK_COUNT: Record<SubjectId, number> = {
  sansu: 3, kokugo: 3, rika: 3, shakai: 3, eigo: 3, ongaku: 3, taiiku: 3, zuko: 3, katei: 3, seikatsu: 3,
};

export interface LandmarkSpot {
  /** 島の中心からの位置（広い画面の半径で作る絵の座標）。y は頂上の面 */
  x: number;
  y: number;
  z: number;
  /** 正面（+z）からの向き */
  rot: number;
}

/** 島の教科の飾りの置き場所。付箋に隠れないよう、手前側（+z）の弧に右・中・左と並べる */
export function landmarkSpots(id: SubjectId): LandmarkSpot[] {
  const wideR = getIslandLayout("wide").find((q) => q.id === id)?.radius ?? 0;
  const layers = layerCount(id);
  const topR = wideR * (1 - ((layers - 1) / layers) * 0.55);
  const n = LANDMARK_COUNT[id];
  const spots: LandmarkSpot[] = [];
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? Math.PI / 2 : 0.6 + (i / (n - 1)) * (Math.PI - 1.2);
    const d = topR * (i === Math.floor(n / 2) ? 0.6 : 0.56);
    spots.push({
      x: Math.cos(a) * d,
      y: summitY(id),
      z: Math.sin(a) * d,
      // 外側へ少しだけ振って、3つが同じ向きに並ばないようにする
      rot: (Math.PI / 2 - a) * 0.45,
    });
  }
  return spots;
}

export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
}

const TREE_COUNT: Record<LayoutMode, number> = { wide: 14, narrow: 8 };

/** 高原の丸い木の置き場所。草地の内側で、丘から離して、種を固定して選ぶ */
export function treeSpots(mode: LayoutMode): TreeSpot[] {
  const land = landOf(mode);
  const hills = getIslandLayout(mode).filter((p) => isHighland(p.id));
  const rng = createRng(mode === "wide" ? 83 : 89);
  const spots: TreeSpot[] = [];
  for (let tries = 0; tries < 2000 && spots.length < TREE_COUNT[mode]; tries++) {
    const t = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 0.78;
    const x = land.x + Math.cos(t) * r * land.rx;
    const z = land.z + Math.sin(t) * r * land.rz;
    if (hills.some((h) => Math.hypot(x - h.x, z - h.z) < h.radius + 0.35)) continue;
    if (spots.some((s) => Math.hypot(x - s.x, z - s.z) < 0.9)) continue;
    spots.push({ x, z, scale: 0.75 + rng() * 0.4 });
  }
  return spots;
}

/** 海の島のふちから高原のふちへ渡る点線の始点と終点。高原に一番近い海の島から引く */
export function landBridge(places: IslandPlace[], mode: LayoutMode): { from: IslandPlace; start: number; end: number; ux: number; uz: number } {
  const land = landOf(mode);
  const dist = (p: IslandPlace) => Math.hypot(land.x - p.x, land.z - p.z);
  const from = places
    .filter((p) => !isHighland(p.id))
    .reduce((a, b) => (dist(b) < dist(a) ? b : a));
  const len = dist(from);
  const ux = (land.x - from.x) / len;
  const uz = (land.z - from.z) / len;
  const toEdge = 1 / Math.hypot(ux / land.rx, uz / land.rz);
  return { from, start: from.radius * 1.12, end: len - toEdge * 0.9, ux, uz };
}

export interface FishRoute {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  sp: number;
  ph: number;
  s: number;
  dir: number;
}

export const FISH_COUNT = 9;

/** 魚の周回路。[中心 x, 中心 z, 半径 x, 半径 z] を組ごとに持つ */
const FISH_SPOTS: Record<LayoutMode, [number, number, number, number][]> = {
  // 中央は生活の島なので、魚は島のあいだを通る
  wide: [[9.4, 2.4, 0.7, 0.4], [-3.75, -5.2, 0.9, 0.4], [3.75, -5.2, 0.9, 0.4], [0, 10.2, 5, 0.4], [-6.1, 2, 0.8, 0.4]],
  narrow: [[4.4, 2, 0.5, 0.3], [0, -3.4, 0.9, 0.3], [0, 6, 0.25, 1], [0, 8.6, 2.6, 0.35]],
};

export function fishRoutes(mode: LayoutMode): FishRoute[] {
  const rng = createRng(21);
  const spots = FISH_SPOTS[mode];
  const routes: FishRoute[] = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    const sp = spots[i % spots.length];
    routes.push({
      cx: sp[0],
      cz: sp[1],
      rx: sp[2],
      rz: sp[3],
      sp: 0.14 + rng() * 0.1,
      ph: i * 1.9 + rng(),
      s: 0.8 + rng() * 0.5,
      dir: i % 2 ? 1 : -1,
    });
  }
  return routes;
}

/** 時刻 t（秒）の魚の位置と向き（yaw） */
export function fishAt(f: FishRoute, t: number): { x: number; z: number; yaw: number } {
  const a = t * f.sp * f.dir + f.ph;
  const dx = -Math.sin(a) * f.rx * f.dir;
  const dz = Math.cos(a) * f.rz * f.dir;
  return { x: f.cx + Math.cos(a) * f.rx, z: f.cz + Math.sin(a) * f.rz, yaw: Math.atan2(-dz, dx) };
}

export const BIRD_COUNT = 3;

/** 鳥 i の時刻 t（秒）の位置と進む向き（単位ベクトル）。rx, rz は一番下の海の紙の半径 */
export function birdAt(i: number, t: number, rx: number, rz: number): { x: number; z: number; tx: number; tz: number } {
  const r = i * 0.9;
  const a = t * (0.11 - i * 0.012) + i * 2.3;
  let tx = -Math.sin(a) * rx;
  let tz = Math.cos(a) * rz;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  return { x: Math.cos(a) * (rx * 0.62 - r), z: Math.sin(a) * (rz * 0.6 - r * 0.5), tx, tz };
}
