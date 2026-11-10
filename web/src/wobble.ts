// 鉛筆で描いたような手描きの揺れ（盤面の道、島の地図の道）。
// 揺れを SVG フィルター（feDisplacementMap）でつけると、画素ごとにずらすので斜めの縁がギザギザになり、
// 細い点線の太さもむらになった（#185）。線の座標そのものを、位置だけで決まるなめらかな量だけずらす。

export type Point = readonly [number, number];

const round = (value: number) => Math.round(value * 10) / 10;

/** 位置 (x, y) だけで決まるなめらかなずれ（大きさは amp まで）。同じ点は何度呼んでも同じだけずれるので、隣の線とのつなぎ目に段差が出ない */
export const wobbleAt = (x: number, y: number, amp: number): [number, number] => [
  amp * (0.6 * Math.sin(0.061 * x + 0.037 * y + 1.3) + 0.4 * Math.sin(0.029 * x - 0.053 * y + 4.1)),
  amp * (0.6 * Math.sin(0.043 * x - 0.058 * y + 2.7) + 0.4 * Math.sin(0.071 * x + 0.023 * y + 0.6)),
];

/** 点を通るなめらかな曲線（Catmull-Rom を3次ベジェにした物）の d。closed なら最後の点から最初の点へ戻して閉じる */
export const smoothPathOf = (points: readonly Point[], closed = false): string => {
  const n = points.length;
  const at = (i: number) => (closed ? points[((i % n) + n) % n] : points[Math.min(n - 1, Math.max(0, i))]);
  const last = closed ? n : n - 1;
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < last; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
};

/** 長さ length の線を、step ごとの点に pointAt(0〜1) で分ける */
export const samplePoints = (length: number, step: number, pointAt: (t: number) => Point): Point[] => {
  const count = Math.max(2, Math.ceil(length / step));
  return Array.from({ length: count + 1 }, (_unused, i) => pointAt(i / count));
};
