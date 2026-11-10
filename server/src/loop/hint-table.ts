// 間違い方の型ごとの直し方。人が書いた規則表で、AI ではない（docs/product/education-api-contract.md「間違い方の型」）。
// 数字を入れない。数字があると、問題の答えを漏らすおそれがあるため（hint-table の検査がある）。

export const NAMED_PATTERNS = ["sum-both", "sum-num-only", "same-den-sum", "lever-same-weight", "lever-inverse"] as const;
export type NamedPattern = (typeof NAMED_PATTERNS)[number];
export type ErrorPattern = NamedPattern | "unclassified";

export const HINT_BY_PATTERN: Record<NamedPattern, string> = {
  "sum-both": "分母がちがうときは、分母どうしを計算しないよ。まず同じ大きさのタイルにそろえよう",
  "sum-num-only": "分子だけを計算すると、そろえる前の大きさのままになるよ。分母をそろえた後の分子で計算しよう",
  "same-den-sum": "分母をそろえたら、分母はそのままで、分子だけをたそう",
  "lever-same-weight": "左と右では、支点からのきょりがちがうよ。重さ × きょりで比べよう",
  "lever-inverse": "支点から遠いほど、軽いおもりでつり合うよ",
};

/** 型が属する教科の章。てこの型は理科（rika）の問題にだけ、分数の型はそれ以外の問題にだけ並べる。 */
export const patternBelongsToChapter = (pattern: NamedPattern, chapterId: string): boolean =>
  pattern.startsWith("lever-") ? chapterId === "rika" : chapterId !== "rika";

/**
 * 直し方の下書きを AI に頼んでよい型か。AI への指示は分数のたし算・ひき算の言葉で書いてあるので、
 * てこの型を渡すと「たしざんをして重さをあわせましょう」のような、てこには合わない文が返る（公開版で確認、2026-11-10）。
 * てこの型は、人が書いた表の案だけを出す。
 */
export const patternDraftsWithAi = (pattern: NamedPattern): boolean => !pattern.startsWith("lever-");

export const isNamedPattern = (value: unknown): value is NamedPattern =>
  typeof value === "string" && (NAMED_PATTERNS as readonly string[]).includes(value);

export const isErrorPattern = (value: unknown): value is ErrorPattern => value === "unclassified" || isNamedPattern(value);
