// 手で切ったような輪郭を、乱数の種から作る。three には依存しない
// 点は [x, z] の並びで、始点を終点に重ねない（閉じた輪郭）

export type Point2 = [number, number];

/** 種から 0〜1 の乱数を返す関数（mulberry32） */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 楕円（exponent を上げると角の丸い四角）のまわりを揺らした輪郭。rough は半径に対する揺れの割合。
 * 低い周波数のうねりだけを重ね、手で切ったような滑らかな揺れにする。drift は段ごとの位相のずれ
 */
export function wobblyOutline(
  seed: number,
  rx: number,
  rz: number,
  options: { points?: number; rough?: number; exponent?: number; drift?: number } = {},
): Point2[] {
  const n = options.points ?? 96;
  const rough = options.rough ?? 0.08;
  const e = options.exponent ?? 2;
  const drift = options.drift ?? 0;
  const rng = createRng(seed);
  const waves = [2, 3, 5, 7].map((k) => ({
    k,
    phase: rng() * Math.PI * 2 + drift * (1 + k * 0.15),
    amp: (0.5 + rng()) / (1 + k * 0.25),
  }));
  const out: Point2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let r = 1;
    for (const w of waves) r += rough * w.amp * Math.sin(w.k * t + w.phase);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const base = Math.pow(Math.pow(Math.abs(c), e) + Math.pow(Math.abs(s), e), -1 / e);
    out.push([c * base * rx * r, s * base * rz * r]);
  }
  return out;
}

/** 島の切り絵の 1 段。layer が上がるほど小さく、輪郭も少しずつ変わる（layer は 0 が一番下） */
export function islandLayerOutline(
  seed: number,
  radius: number,
  layer: number,
  layers: number,
  points = 96,
): Point2[] {
  const shrink = 1 - (layer / layers) * 0.45;
  const r = radius * shrink;
  return wobblyOutline(seed * 131 + 1, r, r * 0.94, { points, rough: 0.1, drift: layer * 0.3 });
}
