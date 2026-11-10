import type { SubjectId } from "../../data";
import { samplePoints, smoothPathOf, wobbleAt } from "../../wobble";
import type { Point } from "../../wobble";

// 隣の島どうしを輪につなぐ点線の道（D-63）。飾りなので読み上げない。
// 点は .island-map__field の島のマスの中心。広い画面も狭い画面も同じ割合になる
const POINTS: Partial<Record<SubjectId, Point>> = {
  kokugo: [50, 16.7],
  rika: [83.3, 50],
  eigo: [75, 83.3],
  shakai: [25, 83.3],
  sansu: [16.7, 50],
  // 生活は1・2年だけ。五角形の下の2島のマスの中央に立つ
  seikatsu: [50, 83.3],
};
const ORDER: readonly SubjectId[] = ["kokugo", "rika", "eigo", "shakai", "sansu", "seikatsu"];

/** 手描きの揺れ。座標は枠の幅・高さを 100 とした割合なので、画面の px に近い大きさ（1 が約 6px）に直してから揺らす */
const PX_PER_UNIT = 6;
const WOBBLE_AMP = 0.25;
const WOBBLE_STEP = 2;

/** 出している島の中心を、国語から時計回りに並べる。揺れを付ける前の道の角 */
export const islandRouteOf = (subjects: readonly SubjectId[]): Point[] =>
  ORDER.filter((id) => subjects.includes(id)).flatMap((id) => {
    const point = POINTS[id];
    return point ? [point] : [];
  });

/** 角から角へまっすぐ点を並べ、点を揺らしてなめらかな輪にする。揺れは位置だけで決まるので毎回同じ形 */
const wobbleRingOf = (route: readonly Point[]): string => {
  const points = route.flatMap((from, i) => {
    const to = route[(i + 1) % route.length];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // 次の辺の始まりと重ならないように、各辺の終わりの点は除く
    return samplePoints(length, WOBBLE_STEP, (t): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]).slice(0, -1);
  });
  return smoothPathOf(
    points.map(([x, y]): Point => {
      const [dx, dy] = wobbleAt(x * PX_PER_UNIT, y * PX_PER_UNIT, WOBBLE_AMP);
      return [x + dx, y + dy];
    }),
    true,
  );
};

/** 出している島だけを、国語から時計回りにつなぐ */
export function IslandPaths({ subjects }: { subjects: readonly SubjectId[] }) {
  const route = islandRouteOf(subjects);
  const d = route.length < 2 ? "" : wobbleRingOf(route);
  return (
    <svg className="island-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
