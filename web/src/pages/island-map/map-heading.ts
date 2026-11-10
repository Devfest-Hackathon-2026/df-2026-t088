// PG-001 の見出し。その日の一言（CP-010〜CP-020）のあとに CP-001 を続ける（D-105）
// 一言は、決まった日 → 曜日 → 季節の順に、先に当てはまったものを使う。日付は端末の時計で見る
import { COPY } from "../../copy";

export function dayWord(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) return COPY.CP_010;
  if (month === 5 && day === 5) return COPY.CP_011;
  if (month === 7 && day === 7) return COPY.CP_012;

  const weekday = date.getDay();
  if (weekday === 1) return COPY.CP_013;
  if (weekday === 5) return COPY.CP_014;
  if (weekday === 0 || weekday === 6) return COPY.CP_015;

  if (month >= 3 && month <= 5) return COPY.CP_016;
  if (month === 6) return COPY.CP_017;
  if (month >= 7 && month <= 8) return COPY.CP_018;
  if (month >= 9 && month <= 11) return COPY.CP_019;
  return COPY.CP_020;
}

/** 見出しの文。画面では「。」の後で改行してよい所に <wbr> を置く（IslandMapPage） */
export function mapHeading(date: Date): string {
  return `${dayWord(date)}。${COPY.CP_001}`;
}
