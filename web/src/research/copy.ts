// 大人向けの画面の言葉（案）。子どもの画面の文言（copy.ts、08_copy.md）とは別で、です・ます調、ふりがなは付けない。
// 言い過ぎない。型は「答えの形が表に合った」ことだけを言い、原因とは呼ばない。AI は文案だけを作り、検査と先生の承認で止める。
import type { ErrorPattern, Role, Scope } from "./api";

export const TIER_COPY = {
  title: "見る段階",
  lead: "人の種類ではなく、見たい粒度と目的から選びます。",
  planned: "まだ作っていません",
  roleDenied: "この役割では見られません",
  storage: "置き場所",
  visible: "見えるもの",
  hidden: "見えないもの",
  audience: "届く人",
  protection: "守り",
  names: {
    personal: "自分の分だけ",
    classRecords: "クラスの 1 件ずつ",
    lessonSummary: "教材ごとの集計",
    schoolSummary: "学校をまたぐ集計",
  },
  // 段階ごとの対象と、既存の役割で見られる範囲をこの表にまとめます。
  access: {
    personal: { audience: ["子ども自身", "保護者"], roles: [] as Role[] },
    classRecords: { audience: ["先生"], roles: ["teacher"] as Role[] },
    lessonSummary: { audience: ["先生", "教材を作る人", "研究者"], roles: ["teacher", "researcher"] as Role[] },
    schoolSummary: { audience: ["学校・教育委員会", "研究者"], roles: ["researcher"] as Role[] },
  },
} as const;

export const RESEARCH_COPY = {
  title: "学びの輪",
  lead: "子どもの間違いの記録が、教材を直して次の子に届くまでを、人が確かめながら動かします。",
  dummyNotice: "これはダミーのデータで動くデモです。記録の分布は私たちが作ったものです。規則で見つけ、AI が下書きし、機械の検査と先生の承認で止めます。本物の子どもの記録は送りません。",
  patternNote: "「間違い方の種類」は、答えの形が表に合ったことを示すだけで、間違いの原因ではありません。分類できるのは、表に合う間違いだけです。",
  patternBreakdown: "間違い方の内訳（5 件以上のものだけ）",
  flowName: "5 つの流れ",
  flow: ["間違える", "記録", "提案", "決める", "届く"],
  tabStudio: "教材をつくる",
  serverChecking: "サーバーを確かめています",
  serverUp: "サーバーにつながっています",
  serverDown: "サーバーにつながっていません。サーバーを起動してから、ページを読み込み直してください",
  roleLegend: "いまの役割",
  roleNote: "画面で選ぶだけの自己申告です。ログインではなく、データを守る仕組みではありません",
  approverKeyNote: "サーバーに設定があるときだけ、承認と操作の記録に要ります。共有の鍵で、本人確認ではありません。このページを閉じると消えます",
  roles: { teacher: "先生", researcher: "研究者" } satisfies Record<Role, string>,
  scopes: { summary: "問題ごとの件数だけ", records: "1 件ずつの記録" } satisfies Record<Scope, string>,
  // 「形」で止める。「分母もたした」のような、考え方の言い切りはしない
  patterns: {
    "sum-both": "分子どうし、分母どうしを計算した形",
    "sum-num-only": "分子だけを計算して、分母は足していない形",
    "same-den-sum": "正しい答えの半分の形（分母もたした形）",
    "lever-same-weight": "左と同じ重さを選んだ形",
    "lever-inverse": "てこの比を逆にした形",
    unclassified: "分類できず",
  } satisfies Record<ErrorPattern, string>,
  stepResponsible: "責任",
  auditTitle: "操作の記録（証跡）",
  auditTableName: "操作の記録",
  auditRegionName: "操作の記録の表",
  auditNote: "どの役割が、いつ、何のために見たか、決めたかの記録です。個人は特定できません。記録を読んだことも残ります",
  auditScrollHint: "横にすべらせると、結果の列が見えます",
  auditEmpty: "まだ何も残っていません",
  auditRead: "操作の記録を読み込む",
  childLegend: "次の子の画面（再現）",
  hintNow: "いまのヒント（ダミー）",
  hintAfter: "承認のあと",
  hintApproved: "（承認された直し方）",
  hintNone: "承認された直し方はまだありません",
  suggestionAi: "AI の下書き",
  suggestionTable: "人が書いた表",
  aiApprovalNote: "先生が確かめてから承認してください",
  candidatePassed: "検査を通過しました",
  candidateFailed: (reason: string) => ({
    empty: "文が空です", too_long: "文が長すぎます", multiple_paragraphs: "文が複数の段落です",
    has_digit: "数字を含んでいます", has_link: "リンクを含んでいます", leak: "答えが分かるおそれがあります",
    wrong_operator: "演算に合わない言葉を含んでいます", timeout: "時間内に届きませんでした",
    error: "文を作れませんでした", check_failed: "検査できませんでした",
  } as Record<string, string>)[reason] ?? "検査に通りませんでした",
  candidateSource: (source: "gemini" | "table") => source === "gemini" ? "Gemini の案" : "表の案",
  aiFallback: (reason: "check_failed" | "timeout" | "error") => ({
    check_failed: "AI の文が検査に通らなかったので、表の文にしました",
    timeout: "AI の文が時間内に届かなかったので、表の文にしました",
    error: "AI の文を作れなかったので、表の文にしました",
  })[reason],
} as const;

export type StepCopy = { title: string; responsible: string; note: string };

export const STEPS: StepCopy[] = [
  {
    title: "子どもが問題を間違える",
    responsible: "子ども（この画面では、ダミーで再現）",
    note: "名前や学校名は送りません。送るのは、学習の名前、問題、間違い方の種類、ヒントを見た数、日にちです（時刻はサーバーが捨てます）",
  },
  { title: "記録が残る", responsible: "サーバー（預かるだけ）", note: "5 件（仮）に満たない問題は、集計にも記録にも出しません" },
  {
    title: "規則表で型を判定し、直し方の文を下書きする",
    responsible: "規則表が型を判定し、AI は文だけを下書きします",
    note: "AI に渡すのは型の名前、規則表の説明、演算だけです。問題の数字、答え、件数は渡しません。先生が承認するまで子どもの画面には出ません",
  },
  {
    title: "先生が確かめて決める",
    responsible: "先生（画面で選ぶだけの自己申告で、本人確認はありません）",
    note: "理由を必ず書きます。決めたことは操作の記録に残ります",
  },
  { title: "直ったヒントが次の子に届く", responsible: "承認した先生", note: "承認されたものだけが届きます。断ったものは届きません" },
];

export const NOTICE = {
  sentOne: (count: number) => `間違えた記録を送りました（これまでに ${count} 件）`,
  needPurpose: "何のために読むかを書いてください",
  needReason: "理由を書いてください",
  noSuggestion: "先に、直し方の案をつくってください",
  hiddenSmall: "5 件（仮）に満たないため、まだ何も出ません",
  suggested: "案をつくりました。先生が確かめてください",
  noSelectableCandidate: "検査を通った候補を選んでください",
  decided: (status: "approved" | "rejected") => (status === "approved" ? "承認しました" : "断りました"),
  replaced: (ids: string[]) => ids.map((id) => `前の承認（${id}）を置き換えました`).join("、"),
  revoked: "承認を取り消しました",
} as const;

export const LABEL = {
  push: "間違えた記録を送る（1 件）",
  pushFive: "5 件まとめて送る",
  read: "記録を読む",
  suggest: "直し方の案をつくる",
  approve: "この案を承認する",
  reject: "この案を断る",
  revoke: "承認を取り消す",
  reload: "次の子の画面を読み直す",
  dummyPattern: "間違い方の種類（ダミー）",
  suggestPattern: "直したい間違い方",
  approverKey: "承認キー",
  purpose: "読む目的",
  purposePlaceholder: "例：分母が違うたし算のつまずきを調べる",
  reason: "理由",
  reasonPlaceholder: "例：単位を先に示す方が手が動きそう",
  scope: "見る範囲",
} as const;
