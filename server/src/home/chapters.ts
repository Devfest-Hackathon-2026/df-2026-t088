// 先生が課題と「章のテスト」をつなぐときに選べる章の写し（#196、Q-29）。
// 正本は web の教材データ（web/src/data/chapters.ts・kokugo.ts の章、web/src/lesson の `{章 id}:test` の出題表）。
// server は web を直に読まない（ビルドの境界）。ずれは chapters.parity.test.ts が止める。
// 選ぶ基準：章のテストの出題表があり、子どもがそのテストを解ける章。
//   今は 5年算数の分数（fraction）と 5年国語の漢字（kokugo-kanji-5）の2つ。
//   整数（integer）・小数（decimal）・式（expression）にもテストの出題表はあるが、curriculum 00 の「問題の組」と
//   09_admin の 1-3 が「分数と国語の漢字の2つ」と書いているため、一番小さい集合にした。増やすときはここと契約を直す。
// name は子どもの画面に出る章の表示名（ふりがなの書き方を除く）。

export type LinkChapter = { chapterId: string; name: string };

export const LINK_CHAPTERS: readonly LinkChapter[] = [
  { chapterId: "fraction", name: "分数" },
  { chapterId: "kokugo-kanji-5", name: "5年の漢字" },
];
