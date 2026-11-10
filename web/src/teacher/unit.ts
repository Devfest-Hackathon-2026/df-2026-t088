import type { SummaryItem } from "../research/api";
import { findAnyChapter } from "../data/courses";
import { plainText } from "../ruby-text";
import { UNIT_COPY } from "./copy";
import type { Period } from "./StumblesPanel";

const PRINT_PREFIX = "print:";

// 問題の名前。プリントのてこは、送るときの数字だけのキー（左2-30g-右3。stumble-reporter.ts）を文にする。ほかはそのまま
export function problemLabel(lessonKey: string, problem: string): string {
  if (lessonKey !== "print:rika-lever") return problem;
  const lever = /^左(\d+)-(\d+)g-右(\d+)$/.exec(problem);
  return lever ? UNIT_COPY.leverProblem(lever[1]!, lever[2]!, lever[3]!) : problem;
}

// 単元の名前：main-N（0 始まり）は「章 N+1マス目」、test は「章 章のテスト」、それ以外（寄り道の id）は「章 寄り道」。
// 章が見つからないときは chapterId をそのまま章の名前にする
export function unitLabel(chapterId: string, lessonKey: string): string {
  // プリントの型（print:rika-lever など）は章を持たない。「rika 寄り道」と出さず、型の名前で出す（#535）
  if (lessonKey.startsWith(PRINT_PREFIX)) {
    const template = UNIT_COPY.printTemplates[lessonKey.slice(PRINT_PREFIX.length)];
    return template ? UNIT_COPY.print(template) : UNIT_COPY.printOther;
  }
  const found = findAnyChapter(chapterId);
  const chapter = found ? plainText(found.tab) : chapterId;
  const main = /^main-(\d+)$/.exec(lessonKey);
  if (main) return UNIT_COPY.mainSquare(chapter, Number(main[1]) + 1);
  if (lessonKey === "test") return UNIT_COPY.chapterTest(chapter);
  return UNIT_COPY.side(chapter);
}

export type UnitRow = {
  chapterId: string;
  lessonKey: string;
  count: number;
  patterns: SummaryItem["patterns"];
};

// 問題ごとの行を、単元（章＋学習）ごとにまとめる。件数と型の件数は合計し、並びは件数の多い順（同じなら章、学習の順）
export function groupByUnit(items: SummaryItem[]): UnitRow[] {
  const map = new Map<string, UnitRow>();
  for (const item of items) {
    const key = `${item.chapterId}\n${item.lessonKey}`;
    const row = map.get(key) ?? { chapterId: item.chapterId, lessonKey: item.lessonKey, count: 0, patterns: [] };
    row.count += item.count;
    for (const entry of item.patterns) {
      const same = row.patterns.find((p) => p.pattern === entry.pattern);
      if (same) same.count += entry.count;
      else row.patterns.push({ ...entry });
    }
    map.set(key, row);
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.chapterId.localeCompare(b.chapterId) || a.lessonKey.localeCompare(b.lessonKey),
  );
}

// 単元の問題の一覧（SCR-T11）へのアドレス。期間が今日のときだけ period を付ける
export function unitHref(chapterId: string, lessonKey: string, period: Period): string {
  const base = `?view=unit&chapter=${encodeURIComponent(chapterId)}&lesson=${encodeURIComponent(lessonKey)}`;
  return period === "today" ? `${base}&period=today` : base;
}
