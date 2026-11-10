// PG-010 しゃしんで しつもん（D-164〜D-172）の型。API の形は docs/product/education-api-contract.md の「プリント撮影の API」
// 設計は docs/design/ui/05_screens-print.md、部品は 04_components-print.md

/** 説明の型の id。フロントとサーバが同じ一覧を持つ（Q-47。最初はてこと月） */
export type TemplateId = "rika-lever" | "rika-moon" | "sansu-fraction-addsub";

/** てこの型の数。めもりは 1〜6、重さは 10〜100 の 10 刻み。答えは left.g × left.pos ÷ right.pos */
export interface LeverParams {
  left: { pos: number; g: number };
  right: { pos: number };
}

/** 月の型は数を持たない */
export type MoonParams = Record<string, never>;

/** 分数のたし算・ひき算の型の数。式 left op right（範囲は fraction-addsub.ts） */
export interface FractionAddSubParams {
  left: { num: number; den: number };
  op: "+" | "-";
  right: { num: number; den: number };
}

interface ProblemBase {
  /** 読みとった問題の文。200文字まで */
  questionText: string;
  /** 型が先生の承認を受けているか。true の時だけ承認の札を出す（Q-46） */
  approved: boolean;
  /** 子どもが学級コードで撮ったとき、サーバーが保存した説明の id。間違いを学びの輪へ送るときに付ける */
  handoutId?: string;
}

export type ReadProblem =
  | (ProblemBase & { templateId: "rika-lever"; params: LeverParams })
  | (ProblemBase & { templateId: "rika-moon"; params: MoonParams })
  | (ProblemBase & { templateId: "sansu-fraction-addsub"; params: FractionAddSubParams });

/** 説明カード（ExplainCard）で見せる型。分数はタイルの学習で解くので、説明カードには来ない */
export type ExplainProblem = Exclude<ReadProblem, { templateId: "sansu-fraction-addsub" }>;

/** POST /api/v1/print/read の成功の本体 */
export interface PrintReadResponse {
  /** 説明できる問題。写真の上から順。1〜6個 */
  problems: ReadProblem[];
  /** 型が無い・数が合わないので落とした数 */
  unsupportedCount: number;
  /** 型の無い問題を需要に数えたか */
  demandRecorded: boolean;
}

/**
 * 失敗の種類。画面の文とボタンが決まる（05_screens-print.md の「失敗と対象外」）
 * - unreadable：PRINT_UNREADABLE、IMAGE_INVALID → CP-879、「とりなおす」だけ
 * - not-supported：PRINT_NOT_SUPPORTED → CP-880、「とりなおす」だけ
 * - unavailable：AI_UNAVAILABLE、BUSY、INTERNAL、知らない code、読めない応答 → CP-881
 * - timeout：TIMEOUT、フロントの 40 秒 → CP-882
 * - rate：RATE_LIMITED → CP-884
 * - offline：つながらない → CP-883
 */
export type PrintErrorKind = "unreadable" | "not-supported" | "unavailable" | "timeout" | "rate" | "offline"
  // closed：学級が子どもの撮影を切っている（401）。daily：今日の回数の上限（429 の scope が day）
  | "closed" | "daily";

/** 写真の上の点。写真の画素の座標（表示の大きさではない） */
export interface Point {
  x: number;
  y: number;
}

/** 写真の上の四角。写真の画素の座標 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
