/** 子どもに見せるマス（寄り道）の名前と説明。`[漢字|よみ]` と `<wbr>` を含められる（C-35、#416） */
export interface KidName {
  /** マスの名前。12字まで（ふりがなと空白、<wbr> を除いて数える） */
  title: string;
  /** 短い説明。学習指導要領の言い回し（「身に付けること」「次のような」など）は入れない */
  learn: string;
}

/** 1つの章の名前の表 */
export interface KidChapterNames {
  /** 章の名前（tab・title）を短くしたいときだけ書く。12字を越えて学習指導要領の文のようなものに限る */
  tab?: string;
  title?: string;
  /** キーはマスの `source`（学習指導要領解説の記号。章の中で重ならない）。無いマスは生成した文のまま出る */
  items: Record<string, KidName>;
  /** キーは寄り道の `id`。生成した章には今は寄り道が無い */
  sides?: Record<string, KidName>;
}

/** 1学年分の表。キーは章の id（`curriculum-items.ts` の章の id。再生成しても変わらない） */
export type GradeKidNames = Record<string, KidChapterNames>;
