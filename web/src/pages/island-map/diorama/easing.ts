// CSS の cubic-bezier(...) と時間の文字列を、アニメーション用の値にする

/** 進み度 x（0〜1）から、イージング後の進み度 y を返す。y は 0〜1 を出てもよい */
export type EasingFn = (x: number) => number;

const BEZIER = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/;

/** `cubic-bezier(a, b, c, d)` を関数にする。解析できなければ null */
export function parseCubicBezier(text: string): EasingFn | null {
  const m = BEZIER.exec(text.trim());
  if (!m) return null;
  const [x1, y1, x2, y2] = [m[1], m[2], m[3], m[4]].map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  const axis = (a: number, b: number, s: number) =>
    3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  const slope = (a: number, b: number, s: number) =>
    3 * (1 - s) * (1 - s) * a + 6 * (1 - s) * s * (b - a) + 3 * s * s * (1 - b);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // x から曲線の媒介変数 s を求める（ニュートン法、だめなら二分法）
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = axis(x1, x2, s) - x;
      if (Math.abs(err) < 1e-6) return axis(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 40; i++) {
      if (axis(x1, x2, s) < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return axis(y1, y2, s);
  };
}

/** `1200ms` や `1.2s` をミリ秒にする。解析できなければ null */
export function parseDuration(text: string): number | null {
  const m = /^([-\d.]+)\s*(ms|s)$/.exec(text.trim());
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return m[2] === "s" ? v * 1000 : v;
}
