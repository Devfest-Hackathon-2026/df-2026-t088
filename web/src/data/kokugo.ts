import { RENAMED_CHAPTERS } from "./curriculum-items";
import type { Chapter } from "./types";

type BaseChapter = Omit<Chapter, "grade" | "subjectId" | "ordered">;

// マスは5年の漢字の4つ。章の名前は「5年の漢字」のまま（C-26。(1)エ の本文は長く章札に収まらないので使わない。本文の出典は sources と items の source に残す）
const BASE_CHAPTERS: BaseChapter[] = [
  {
    id: "kokugo-kanji-5",
    tab: "5[年|ねん]",
    title: "5[年|ねん]の[漢字|かんじ]",
    // 82102D3110000000 は〔知識及び技能〕(1)全体のコード。(1)エ単独のコードはない。
    sources: ["学習指導要領 国語 第5学年及び第6学年 2(1)エ"],
    items: [
      { title: "[熟語|じゅくご]の[読|よ]み", learn: "5[年|ねん]の[漢字|かんじ]の[音読|おんよ]みを[知|し]る", source: "学習指導要領 国語 第5学年及び第6学年 2(1)エ", codes: ["82102D3110000000"], tentative: true },
      { title: "[送|おく]りがな", learn: "[漢字|かんじ]にあう[送|おく]りがなを[読|よ]む", source: "学習指導要領 国語 第5学年及び第6学年 2(1)エ", codes: ["82102D3110000000"], tentative: true },
      { title: "[読|よ]みを[書|か]く", learn: "[漢字|かんじ]の[読|よ]みをひらがなで[書|か]く", source: "学習指導要領 国語 第5学年及び第6学年 2(1)エ", codes: ["82102D3110000000"], tentative: true },
      { title: "[同|おな]じ[読|よ]みの[字|じ]", learn: "[文|ぶん]にあう[漢字|かんじ]を[選|えら]ぶ", source: "学習指導要領 国語 第5学年及び第6学年 2(1)エ", codes: ["82102D3110000000"], tentative: true },
    ],
    sides: [],
  },
];

/** 国語の漢字の章。仮は Q-01 まで */
export const KOKUGO_CHAPTERS: Chapter[] = BASE_CHAPTERS.map((chapter) => {
  const names = RENAMED_CHAPTERS[chapter.id];
  return { ...chapter, grade: 5, subjectId: "kokugo", ordered: false, tab: names?.tab ?? chapter.tab, title: names?.title ?? chapter.title };
});
