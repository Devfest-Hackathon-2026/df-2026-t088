import type { Grade } from "./kanji-grades";

export type SubjectId = "kokugo" | "sansu" | "rika" | "shakai" | "eigo" | "ongaku" | "taiiku" | "zuko" | "katei" | "seikatsu";
export type SideType = "training" | "advanced";
export type GearId = "pencil" | "hat" | "cape" | "wings" | "crown";
export type IconName = "check" | "lock" | "training" | "advanced" | "star" | "hanamaru";

export interface Subject {
  id: SubjectId;
  name: string;
  /** 教科の識別色。トークン名で書く */
  color: string;
}

export interface Equipment {
  level: number;
  id: GearId;
  name: string;
}

export interface SideTypeInfo {
  /** ふりがな記法つき */
  name: string;
  icon: IconName;
}

/** 本線のマス。title と learn はふりがな記法 `[漢字|よみ]` と `<wbr>` を含む */
export interface MainItem {
  title: string;
  learn: string;
  /** 学習指導要領解説の記号。画面には出さない（D-12） */
  source: string;
  /** source に対応する学習指導要領コード（文部科学省の 82V12）。画面には出さない（D-80） */
  codes: string[];
  /** 学習指導要領の本文（ふりがな記法つき）。先生側・データ側の対応表。子どもの画面には出さない（D-152、C-35） */
  guideline?: string;
  /** 内容が仮であること。画面には出さない */
  tentative?: boolean;
}

/** 寄り道。after は分かれる本線のマスの索引（0 始まり）。終えたマスの数がこの値以上になると開く */
export interface Side {
  id: string;
  type: SideType;
  after: number;
  title: string;
  learn: string;
  /** 学習指導要領解説の記号。無い寄り道もある。画面には出さない（D-12） */
  source?: string;
  /** source に対応する学習指導要領コード。source が無い寄り道には無い（D-80） */
  codes?: string[];
  /** 学習指導要領の本文（ふりがな記法つき）。子どもの画面には出さない（D-152、C-35） */
  guideline?: string;
  /** 別のモックへのリンク。PG-003 がつながるまでは使わない */
  href?: string;
  hrefLabel?: string;
  /** 内容が仮であること。画面には出さない（D-12）が、データには残す */
  tentative: boolean;
}

/** 算数の分野。学習指導要領解説の記号 A〜D に対応する（D-74） */
export type DomainId = "number" | "shape" | "change" | "data";

export interface Domain {
  id: DomainId;
  name: string;
}

export interface Chapter {
  id: string;
  /** この章を学ぶ学年 */
  grade: Grade;
  subjectId: SubjectId;
  /** 章の1本道があるか（教科の isOrdered を写す。FR-004） */
  ordered: boolean;
  /** 章の道に出す短い名前。今の章だけ title を出す */
  tab: string;
  title: string;
  /** 章の出典の記号。画面には出さない（D-12） */
  sources: string[];
  /** 属する分野。sources の先頭の記号（A→number, B→shape, C→change, D→data） */
  domain?: DomainId;
  items: MainItem[];
  sides: Side[];
}

/** 1つの学年の、教科の章の基準（D-81）。CHAPTERS と違い、盤面のマスは持たない */
export interface CurriculumChapter {
  /** 学習指導要領の言葉。子どもに見せる名前ではない。画面には出さない（D-12） */
  name: string;
  /** 学習指導要領の記号。画面には出さない（D-12） */
  sources: string[];
  /** 分野や領域の名前。社会と英語には無い */
  area?: string;
  /** 学習指導要領コード（文部科学省の 82V12）。画面には出さない（D-80） */
  codes: string[];
  /** 対応する CHAPTERS の章。5年の算数だけ持つ */
  chapterId?: string;
}

export interface SubjectCurriculum {
  subjectId: SubjectId;
  /** この章を学ぶ学年。学習指導要領が2学年まとめの教科は2つ入る */
  years: number[];
  /** 章の並びに順番の根拠があるか。false は領域の一覧で、順番に意味は無い */
  isOrdered: boolean;
  chapters: CurriculumChapter[];
}

export interface GradeCurriculum {
  grade: number;
  subjects: SubjectCurriculum[];
}

export interface ChapterProgress {
  /** 終えた本線のマスの数 */
  done: number;
  /** 終えた寄り道の id */
  sides: string[];
  /** 章のテストをクリアしたか */
  test: boolean;
}

/** 端末に保存する値（05_screens.md「保存する値」） */
export interface GameState {
  chapterId: string;
  /** 経験値で身につく装備のうち、本人がはずした物の id */
  takenOff: GearId[];
  xp: Record<SubjectId, number>;
  progress: Record<string, ChapterProgress>;
  /** 算数を選んだか。PG-001 を出すかどうかに使う */
  sansuSelected: boolean;
  /** 盤面の最初の説明を読んだか */
  introSeen: boolean;
}
