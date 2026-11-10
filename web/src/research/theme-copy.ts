// 研究テーマのタブの言葉。測り方の説明であって、結果ではない。効果は言わない。
import type { HintVersion, NextOutcome, ThemeStage } from "./api";

export const THEME_COPY = {
  tabFlow: "流れを動かす",
  tabTheme: "研究テーマ",
  title: "ヒントを替えたあと、次の答えは近づいたか",
  question: "承認したヒントに替えたあと、そのヒントを見た子の次の答えは、元のヒントのときより正解に近づいたか。",
  how: "ヒントは最初の間違いのあとに出るので、「最初の間違いが減ったか」では測れません。測るのは、ヒントを見たあとの最初の答えです。結果は 3 つ：正解、同じ種類の間違いのまま、別の間違い。",
  honest: "これは測り方の決まりです。結果ではありません。ここにある記録はダミーで、効果が出たとは言いません。AI は使っていません。",
  stageName: "いまの進み具合",
  stages: {
    collecting: "記録を集めている（名前のある型の間違いが、同じ問題で 5 件に届かない）",
    proposal: "直し方の案をつくれる",
    approved: "承認した。まだ届いた記録がない",
    comparing: "承認後の記録がある",
  } satisfies Record<ThemeStage, string>,
  stageOrder: ["collecting", "proposal", "approved", "comparing"] satisfies ThemeStage[],
  versions: { base: "元のヒント", approved: "承認したヒント" } satisfies Record<HintVersion, string>,
  outcomes: { correct: "正解", same: "同じ間違いのまま", other: "別の間違い" } satisfies Record<NextOutcome, string>,
  cellsName: "前後の比べ",
  cellsNote: "5 件に届かない区画は出しません。出ない分は、全体から引くと分かります。",
  cellsEmpty: "まだ、5 件に届いた区画がありません",
  comparable: "元のヒントと承認したヒントの両方が 5 件以上あります。比べられます",
  notComparable: "まだ比べられません。両方が 5 件以上になるまで集めます",
  dummyTitle: "測り方の例（ダミー）",
  dummyNote: "測り方の例です。結果ではありません。私たちが作った分布を入れて、集計の形を確かめるだけです。",
  dummyBase: "元のヒントのあとの 5 件を入れる（正解 1、同じ間違い 3、別の間違い 1）",
  dummyApproved: "承認したヒントのあとの 5 件を入れる（正解 3、同じ間違い 1、別の間違い 1）",
  reload: "進み具合を読み込む",
  waiting: "読み込み中です",
} as const;
