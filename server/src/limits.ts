export const LIMITS = {
  expressionLength: 40,
  explanationLength: 200,
  questionLength: 80,
  historyPairs: 2, // 仮：AIへ渡す会話は直近2組まで
  maxFractionTerm: 1000, // 仮：入力の式の分子・分母の上限（桁あふれと過大な部品の防止）
  timeoutMilliseconds: 15_000,
  retries: 1,
  maxPieceTypes: 6, // 仮：画面に並べられる部品の種類数
  maxPiecesPerType: 100, // 仮：部品1種類あたりの枚数
  minHints: 1, // 仮：最低限必要なヒント数
  maxHints: 3, // 仮：一度に持つヒント数
  bodyBytes: 8192, // 仮：/api/v1 の POST の本文の上限
  requestsPerMinute: 60, // 仮：接続元ごと、1 分あたり
  submissionRequestsPerMinute: 120, // 仮：提出物を出す・取り消す（PUT・DELETE）は、学級が同じ接続元から一度に押すので別に多く数える（#187、HM-23）
  aiRequestsPerMinute: 10, // 仮：AI を呼ぶ API（parts、similar-problem、reflection）は、接続元ごと、1 分あたり
  printRequestsPerMinute: 10,
  printHedgeAfterMilliseconds: 5_000, // プリント読み取りで、AI がこの時間までに返らなければ、もう 1 本だけ出す
  printBodyBytes: 2_621_440,
} as const;
