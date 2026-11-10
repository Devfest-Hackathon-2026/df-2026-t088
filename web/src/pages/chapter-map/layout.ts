import { useEffect, useState } from "react";

// 1行の章の数（07）。〜767px は1章、768〜1023px は2章、1024px〜は4章
export const COLUMN_QUERIES = [
  { query: "(min-width: 1024px)", columns: 4 },
  { query: "(min-width: 768px)", columns: 2 },
] as const;
const NARROW_COLUMNS = 1;

function readColumns(): number {
  if (typeof matchMedia !== "function") return COLUMN_QUERIES[0].columns;
  return COLUMN_QUERIES.find((entry) => matchMedia(entry.query).matches)?.columns ?? NARROW_COLUMNS;
}

/** 幅に合わせた1行の数。幅が変わったら更新する */
export function useColumns(): number {
  const [columns, setColumns] = useState(readColumns);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const lists = COLUMN_QUERIES.map((entry) => matchMedia(entry.query));
    const update = () => setColumns(readColumns());
    update();
    lists.forEach((list) => list.addEventListener("change", update));
    return () => lists.forEach((list) => list.removeEventListener("change", update));
  }, []);
  return columns;
}

export interface RoadSpot {
  /** 行（0始まり） */
  row: number;
  /** 行の左端の印（0）から右端の印（1）までのどこか。道の両端の余白を除いた幅に対する割合 */
  fx: number;
}

/**
 * 道の上の i 番目の置き場所。0 がスタート、1〜章の数が章、最後がゴール（D-109）。
 * 1行目はスタートがあるので、印を行の幅を1行の数で割った位置に置く。2行目からは半分ずらす。
 * 偶数行は左から右、奇数行は右から左へ進む。DOM の順は変えず、位置だけで並べる
 */
export function roadSpot(index: number, columns: number): RoadSpot {
  const row = Math.floor(index / columns);
  const offset = index % columns;
  const t = row === 0 ? offset / columns : (offset + 0.5) / columns;
  return { row, fx: row % 2 === 0 ? t : 1 - t };
}

/** 道の行の数（スタートと章とゴールを並べた数） */
export function roadRows(count: number, columns: number): number {
  return Math.ceil(count / columns);
}
