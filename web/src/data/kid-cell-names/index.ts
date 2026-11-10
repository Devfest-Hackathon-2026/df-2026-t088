// 子どもに見せるマスの名前の表（手書き）。生成ファイル curriculum-items.ts の title・learn を、courses.ts がこの表で置き換える。
// 学年ごとのファイルだけを直せばよい（grade1.ts〜grade6.ts）。ここは全学年をまとめるだけ
import type { Chapter } from "../types";
import { GRADE1_KID_NAMES } from "./grade1";
import { GRADE2_KID_NAMES } from "./grade2";
import { GRADE3_KID_NAMES } from "./grade3";
import { GRADE4_KID_NAMES } from "./grade4";
import { GRADE5_KID_NAMES } from "./grade5";
import { GRADE6_KID_NAMES } from "./grade6";
import type { GradeKidNames } from "./types";

export type { GradeKidNames, KidChapterNames, KidName } from "./types";

export const KID_CELL_NAMES: GradeKidNames = {
  ...GRADE1_KID_NAMES,
  ...GRADE2_KID_NAMES,
  ...GRADE3_KID_NAMES,
  ...GRADE4_KID_NAMES,
  ...GRADE5_KID_NAMES,
  ...GRADE6_KID_NAMES,
};

/**
 * 生成した章に、子ども向けの名前を当てる。名前のあるマス・寄り道は title・learn を置き換え、元の title（学習指導要領の本文）を guideline に残す。
 * 名前の無いマスと、表の無い章はそのまま。章の名前（tab・title）は表に書いたときだけ置き換える
 */
export function applyKidNames(chapter: Chapter, table: GradeKidNames = KID_CELL_NAMES): Chapter {
  const names = table[chapter.id];
  if (!names) return chapter;
  return {
    ...chapter,
    tab: names.tab ?? chapter.tab,
    title: names.title ?? chapter.title,
    items: chapter.items.map((item) => {
      const kid = names.items[item.source];
      return kid ? { ...item, title: kid.title, learn: kid.learn, guideline: item.title } : item;
    }),
    sides: chapter.sides.map((side) => {
      const kid = names.sides?.[side.id];
      return kid ? { ...side, title: kid.title, learn: kid.learn, guideline: side.title } : side;
    }),
  };
}
