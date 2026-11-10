// 先生の画面（今日のつまずき）の文言。正本は docs/design/ui/08_copy.md の「先生の画面」（CP-931〜CP-946）。
// 同じ ID と文言を保つ。大人向けなので、ふりがなは付けない。
export const TODAY_COPY = {
  title: "今日のつまずき", // CP-931
  question: "今日、どの問題でつまずいていますか", // CP-932
  empty: "今日の記録はまだありません", // CP-933
  hiddenNote: "件数が少ないものは出していません。個人が分からないようにするためです", // CP-934（学級のようすでは出さない。D-183）
  connError: "サーバーにつながりませんでした。少し待って、もう一度開いてください", // CP-935
  loading: "読み込んでいます", // CP-946
  count: "件",
  purpose: "今日のつまずきを見る（先生の画面）",
} as const;

// 問題の詳細（SCR-T02）。CP-936〜938、CP-955〜959
export const PROBLEM_COPY = {
  title: "問題の詳細", // CP-936
  question: "この問題で、どの直し方が出ていますか", // CP-937
  empty: "直し方はまだありません", // CP-938
  makeSuggestion: "直し方を作る", // CP-955
  suggestedNote: "承認は次の画面で、理由を書いて決めます", // CP-956
  approved: "承認済み", // CP-957
  makeError: "直し方を作れませんでした。少し待って、もう一度押してください", // CP-958
  notFound: "この問題は、今は出せる件数がありません", // CP-959
  lessonName: "学習の名前",
  back: "学級のようすにもどる", // CP-960（D-174）
  purposeProblem: "問題の詳細を見る（先生の画面）",
} as const;

// 先生のログイン（CP-967〜969）。ログインが on のときだけ出る
export const LOGIN_COPY = {
  intro: "先生としてログインします。学校の Google アカウントを使います", // CP-967（名簿だけのときに出す。だれでも入れる open のときは CP-1224）
  failed: "ログインできませんでした。先生の名簿にあるアカウントで、もう一度入ってください", // CP-968
  button: "Google アカウントでログイン", // CP-969
  unknown: "先生のログインを確かめられませんでした。サーバーにつながっていません", // CP-1195（D-208）
  retry: "もう一度ためす", // CP-1196
  heading: "先生のログイン", // CP-1223
  signupOpen: "Google アカウントで入ると、自分の学級ができます。審査・お試しの方も、ここから入れます。", // CP-1224
  // ログインなしで学級ができる設定（signup が guest のとき）
  guestHeading: "先生の画面", // CP-1267
  guestIntro: "お試しの学級をつくると、プリントを撮って配るところまで、そのまま試せます。ログインは要りません。", // CP-1268
  guestButton: "お試しの学級をつくる", // CP-1269
  guestFailed: "学級をつくれませんでした。もう一度ためしてください", // CP-1270
} as const;

// 先生の上の並び（入っているとき）。学級の名前・コード・子ども用のリンク・ログアウト
export const WORKSPACE_COPY = {
  nameLabel: "学級の名前",
  codeLabel: "学級コード",
  linkLabel: "子ども用のリンク",
  copy: "コピーする",
  copied: "コピーしました",
  copyFailed: "コピーできませんでした。リンクを選んで、手でコピーしてください",
  renameFailed: "名前を直せませんでした。もう一度ためしてください",
  logout: "ログアウト",
  closeClass: "学級をとじる", // CP-1271（お試しの学級のとき、ログアウトの代わり）
  confirmCloseClass: "この学級と、配った説明は 開けなくなります。とじますか？", // CP-1272
  childCaptureLabel: "子どもが 自分で 撮ってよい", // CP-1273
  childCaptureNote: "入れると、この学級の子が自分のプリントを撮って、動く説明を見られます。写真は保存しません。読めるのは、てこと月の問題だけです", // CP-1274
  childCaptureFailed: "切り替えられませんでした。もう一度ためしてください", // CP-1275
  childMark: "子どもが撮った（先生は確かめていません）", // CP-1276
  rateLimited: "今日の読み取りの回数を使い切りました。あしたまた使えます",
  sessionEnded: "ログインが切れました。ページを開き直して、もう一度入ってください",
  logoutFailed: "ログアウトできませんでした。もう一度押してください",
  closeClassFailed: "学級をとじられませんでした。もう一度押してください",
  // 続けて読み取りすぎたとき（429 の scope が minute）。待つ秒数は server が返す
  readTooFast: (seconds: number) => `続けて読み取りすぎました。あと ${seconds} 秒待ってから、もう一度押してください`,
  // 問題は読めたが、どれにも動く説明が無い（422 PRINT_NOT_SUPPORTED）。撮り直しても変わらない
  readNotSupported: "この写真の問題には、まだ動く説明がありません。撮り直しても変わりません。",
  readNotSupportedCounted: "どの単元かを数えて、クラスの画面に出します。",
} as const;

// 直し方の承認（SCR-T03）。CP-939〜945、CP-961〜965。取り消し（UC-04）は、この画面では出さない
export const DECIDE_COPY = {
  title: "直し方の承認", // CP-939
  question: "この直し方を、承認しますか", // CP-940
  reasonLabel: "理由（必須。100字まで）", // CP-941
  needReason: "理由を書くと、押せます", // CP-942
  approve: "承認する", // CP-943
  reject: "断る", // CP-944
  approvedDone: "承認しました。記録に残しました", // CP-945
  rejectedDone: "断りました。記録に残しました", // CP-962
  failed: "決められませんでした。少し待って、もう一度押してください", // CP-963
  keyNeeded: "承認キーが要ります。先生の承認キーを入れてください", // CP-964
  keyLabel: "承認キー", // CP-964 の欄の名前
  alreadyDecided: "この直し方は、もう決まっています", // CP-965
  linkToDecide: "この直し方を確かめて決める", // CP-961
  back: "問題の詳細にもどる", // CP-966
  purposeDecide: "直し方を承認する（先生の画面）",
} as const;

// 間違い方の型の名前（CP-947〜950 と同じ文）。分類できないものは直し方を作らない
export const PATTERN_LABEL = {
  "sum-both": "分子どうし、分母どうしを計算した形",
  "sum-num-only": "分子だけを計算して、分母は足していない形",
  "same-den-sum": "正しい答えの半分の形（分母もたした形）",
  "lever-same-weight": "左と同じ重さを選んだ形",
  "lever-inverse": "てこの比を逆にした形",
  unclassified: "分類できず",
} as const;

// 提出の状況（SCR-T05、#187）。CP-970〜980。承認キーの案内は CP-964（DECIDE_COPY.keyNeeded）を使う
export const SUBMISSIONS_COPY = {
  title: "提出の状況", // CP-970
  question: "だれが、まだ出していませんか", // CP-971
  colDue: "期限", // CP-972
  colTitle: "提出物", // CP-973
  colCount: "出した", // CP-974
  colMissing: "出していない人", // CP-975
  missingCount: (count: number) => `${count}人`, // CP-1123。半分より多い時だけ。押すと番号を開く（D-193）
  late: "おくれて出した", // CP-976
  refresh: "新しくする", // CP-977
  refreshedAt: (time: string) => `${time} に新しくしました`, // CP-978
  allDone: "全員が出しました", // CP-979
  connError: (time: string) => `サーバーにつながりませんでした。${time} の数を出しています`, // CP-980
  keyApply: "この承認キーで開く",
} as const;

// 名簿（SCR-T05）。CP-982〜989。名簿はこの端末だけに置き、サーバーには送らない（D-T01、D-T06）
export const ROSTER_COPY = {
  title: "名簿", // CP-982
  help: "「番号 名前」を1行に1人ずつ貼り付けてください。名簿はこの端末だけに保存し、サーバーには送りません。共有の端末では使わないでください", // CP-983
  save: "名簿にする", // CP-984
  saved: (count: number, failed: number) => `${count}人を名簿にしました。読めなかった行が ${failed} 行あります`, // CP-985
  sample: "見本の名簿を入れる", // CP-986
  clear: "名簿を消す", // CP-987
  confirmClear: "この端末の名簿を消しますか", // CP-988
  confirmYes: "消す", // CP-989
} as const;

// 子どものアカウント（SCR-T09）。CP-981、CP-991〜999。
// 画面は、名前をサーバに置くこととログインの導入の承認（UI の Q-37、Q-38）の後に作る。文言だけを先に正本とそろえておく
export const STUDENT_ACCOUNT_COPY = {
  connError: "サーバーにつながりませんでした。もう一度おしてください", // CP-981
  title: "子どものアカウント", // CP-991
  help: "子どもが学校の Google か Microsoft のアカウントでログインできるように、番号・名前・メールを登録します", // CP-992
  colNumber: "番号", // CP-993
  colName: "名前", // CP-994
  colEmail: "ログインのメール", // CP-995
  pasteHelp: "表計算ソフトから、番号・名前・メールの3列を貼り付けてください", // CP-996
  register: "登録する", // CP-997
  confirmRemove: (name: string) => `${name} さんの登録を消しますか。消すと、ログインできなくなります`, // CP-998
  failedRows: (count: number) => `${count}行は登録できませんでした。メールの形を確かめてください`, // CP-999
} as const;

// 見本の名簿（CP-990）。架空の30人。A-01 から順
export const ROSTER_SAMPLE_NAMES = [
  "青木 ひなた", "石川 そうた", "上田 みお", "遠藤 はると", "大野 ゆい", "加藤 れん", "木村 さき", "小林 ゆうと", "斉藤 あおい", "佐野 こうき",
  "島田 めい", "杉山 たくみ", "高橋 りこ", "田村 しょう", "千葉 ことね", "土屋 だいち", "中川 ほのか", "西村 けいた", "野口 まな", "長谷川 ゆうき",
  "平野 あかり", "藤田 りく", "前田 ちひろ", "松本 かいと", "宮本 ゆな", "村井 そら", "森 さくら", "山口 ひろと", "横山 ひより", "渡辺 けんた",
] as const;

// 課題・時間割の管理（SCR-T06〜T08、#196）。CP-1001〜CP-1088。大人向けなので、ふりがなは付けない。
// 押せない理由は、ボタンを disabled にせず、入力欄の下に出す（09_admin.md の決まり）
export const ADMIN_COPY = {
  navAssignments: "課題", // CP-1059
  navTimetable: "時間割", // CP-1060
  navToday: "今日のつまずき", // CP-1061
  notAuthorized: "承認キーを入れてください", // CP-1057
  // CP-1057 この画面を見るには、先生のログインが要ります（401 の表示を承認キー案内に変更）
  loginRequired: "先生のログインが必要です。ログインしてから、もう一度押してください", // CP-1056
  editLoginOnly: "先生のログインが on のときだけ編集できます",
  approverKeyPlaceholder: "審査・デモ用", // CP-1197
  approverKeyNote: "審査・デモ用の入口です。学校で使うときは、先生のログインを使います。", // CP-1198
  invalidInput: "入力の内容を確かめてください", // CP-1055
  chooseHint: "選んでください", // CP-1058
  saving: "保存しています。終わるまで、もう一度押さないでください", // CP-1052、CP-1088
} as const;

// 課題の一覧（SCR-T06）。CP-1001〜1020
export const ASSIGNMENTS_COPY = {
  title: "課題", // CP-1001
  newButton: "新しく配る", // CP-1002
  colDue: "期限", // CP-1003
  colSubject: "教科", // CP-1004
  colTitle: "提出物", // CP-1005
  colCount: "出した", // CP-1006
  colActions: "操作", // CP-1007
  edit: "直す", // CP-1008
  remove: "消す", // CP-1009
  empty: "課題はまだありません。新しく配ると、子どもの画面に出ます", // CP-1010
  connError: "サーバーにつながりませんでした。もう一度開いてください", // CP-1011
  countUnknown: "出した数を、まだ確かめられません", // CP-1012
  confirmRemove: (title: string, count: number) => `「${title}」を消します。出した人 ${count} 人の記録も消えます`, // CP-1013
  confirmRemoveUnknown: (title: string) => `「${title}」を消します。出した数を、まだ確かめられません`, // CP-1021
  confirmNote: "消すと、元に戻せません", // CP-1014
  confirmYes: "消す", // CP-1015
  confirmNo: "やめる", // CP-1016
  removed: (title: string, count: number) => `${title} を消しました。出した人 ${count} 人の記録も消しました`, // CP-1017
  added: (title: string) => `${title} を配りました`, // CP-1018
  updated: (title: string) => `${title} を直しました`, // CP-1019
  loading: "課題を読み込んでいます", // CP-1020
} as const;

// 課題の入れ方（SCR-T07。新しく配る・直す の共通）。CP-1030〜1054
export const ASSIGNMENT_FORM_COPY = {
  titleNew: "課題を配る", // CP-1030
  titleEdit: "課題を直す", // CP-1031
  colSubject: "教科", // CP-1032
  colName: "名前（1〜20字）", // CP-1033
  count: (length: number) => `${length}/20字`, // CP-1034
  rubyNote: "ふりがなを付けるときは、語を角かっこで囲み、縦棒の後に読みを書きます。字数はふりがなを除いて数えます", // CP-1035
  colDueDate: "期限の日付", // CP-1036
  colDueTime: "期限の時刻", // CP-1037
  hour: "時", // CP-1038
  minute: "分（5分ごと）", // CP-1039
  colLink: "アプリの学習とのつながり", // CP-1040
  linkNone: "つなげない", // CP-1041
  linkChapter: "章のテストとつなぐ", // CP-1042
  colChapter: "章", // CP-1043
  save: "保存", // CP-1044
  cancel: "やめる", // CP-1045
  needSubject: "教科を選んでください", // CP-1046
  needName: "名前を入れてください", // CP-1047
  nameTooLong: "名前は20字までです。短くしてください", // CP-1048
  needDate: "期限の日付を入れてください", // CP-1049
  needTime: "期限の時刻を入れてください", // CP-1050
  needChapter: "章を選んでください", // CP-1051
  saveFailed: "保存できませんでした。入力は残っています。もう一度押してください", // CP-1053
  notFound: "指定の課題が見つかりません。一覧にもどってください", // CP-1054
} as const;

// 時間割（SCR-T08）。CP-1070〜1088
export const TIMETABLE_COPY = {
  title: "時間割", // CP-1070
  help: "曜日とコマごとに教科を決めます。保存すると、子どもの画面の時間割が変わります", // CP-1071（今は出さない。D-189）
  addDay: "曜日を増やす", // CP-1072
  removeDay: "曜日を減らす", // CP-1073
  addPeriod: "コマを増やす", // CP-1074
  removePeriod: "コマを減らす", // CP-1075
  save: "保存", // CP-1076
  discard: "未保存の変更を捨てる", // CP-1077
  empty: "—", // CP-1078
  periodLabel: (period: number) => `${period}時間目`, // CP-1079
  weekdayNames: "月、火、水、木、金、土、日", // CP-1080
  saved: "時間割を保存しました", // CP-1081
  maxDays: "曜日は7つまでです", // CP-1082
  minDays: "曜日は1つ以上必要です", // CP-1083
  maxPeriods: "コマは8つまでです", // CP-1084
  minPeriods: "コマは1つ以上必要です", // CP-1085
  saveFailed: "保存できませんでした。表は残っています", // CP-1086
  duplicateDay: "同じ曜日が2つあります。どちらかを直してください", // CP-1087
} as const;

// 学級のようす（SCR-T10）と子どもの進み（SCR-T04）。CP-1089〜CP-1115（#235、D-173〜D-180、teacher の D-T09）
export const CLASS_COPY = {
  title: "学級のようす", // CP-1089
  tabStumbles: "詰まっている問題", // CP-1090
  tabProgress: "子どもの進み", // CP-1091
  tabLoop: "学びの輪", // CP-1127
  periodLabel: "期間", // CP-1092
  period7days: "直近7日", // CP-1093
  periodToday: "今日", // CP-1094
  subjectLabel: "教科", // CP-1203
  empty7days: "直近7日の記録はまだありません", // CP-1095
  colProblem: "問題", // CP-1096
  colLesson: "学習", // CP-1097（今は出さない。D-185）
  colCount: "件数", // CP-1098
  colPatterns: "多い型", // CP-1099
  otherPatterns: (n: number) => `ほか ${n}`, // CP-1100
  lastStudied: "最後に学んだ日", // CP-1101
  notYet: "まだ", // CP-1102
  progressNote: "子どもが学ぶと、ここの進みが増えていきます", // CP-1103
  noClass: "学級を作ると、子どもの進みが見られます", // CP-1104
  noStudents: "この学級には、まだ子どもが登録されていません", // CP-1105
  studiedToday: (studied: number, total: number) => `今日学んだ人 ${studied} / ${total}`, // CP-1280
  todayOnly: "今日学んだ子だけ", // CP-1281
  noTodayStudied: "今日学んだ子は、まだいません", // CP-1282
  cellLabel: (chapter: string, total: number, done: number) => `${chapter}、${total}マスのうち${done}マスを終えました`, // CP-1106
  rowLabel: (number: string, name: string) => `${number} ${name}の進みを開く`, // CP-1107
  doneMark: "終えた", // CP-1108
  next: "つぎ", // CP-1109
  noRecord: "まだ記録がありません", // CP-1110
  notInClass: "この番号の子どもは、この学級にいません", // CP-1111
  date: (month: number, day: number, weekday: string) => `${month}/${day}（${weekday}）`, // CP-1112
  allDone: "全部終えました", // CP-1113
  nextSquare: (name: string) => `つぎ：${name}`, // CP-1114
  noName: "—", // CP-1115
  noNameLabel: "名前なし", // CP-1115 の読み上げ
  purpose: "学級のようすを見る（先生の画面）",
} as const;

// 単元（章＋何マス目）で並べる（SCR-T10 の「詰まっている問題」と SCR-T11 単元の問題の一覧）。CP-1116〜CP-1122（#255、D-188）
export const UNIT_COPY = {
  colUnit: "単元", // CP-1116
  mainSquare: (chapter: string, n: number) => `${chapter} ${n}マス目`, // CP-1117
  chapterTest: (chapter: string) => `${chapter} 章のテスト`, // CP-1118
  side: (chapter: string) => `${chapter} 寄り道`, // CP-1119
  // プリントの型（lessonKey が print:…）。章が無いので、型の名前で出す（#535）
  print: (template: string) => `プリント（${template}）`,
  printTemplates: { "rika-lever": "てこ", "rika-moon": "月", "sansu-fraction-addsub": "分数" } as Record<string, string>,
  printOther: "プリント",
  // プリントのてこの問題（左{目もり}-{重さ}g-右{目もり}）を文にする
  leverProblem: (leftPos: string, leftG: string, rightPos: string) => `左の ${leftPos} の目もりに ${leftG}g、右は ${rightPos} の目もり`,
  title: (unit: string) => `${unit}で詰まっている問題`, // CP-1120
  backToUnit: "単元の問題にもどる", // CP-1121
  empty: "この単元で出せる問題はありません", // CP-1122
} as const;

// 先生の管理（SCR-T12、#351）。CP-1168〜CP-1194。大人向けなので、ふりがなは付けない。正本は docs/design/ui/08_copy.md
export const MEMBERS_COPY = {
  title: "先生の管理", // CP-1168
  intro: "学校の Google アカウントのメールアドレスごとに、役割を決めます。管理者は先生を足し外しでき、先生はそれ以外のすべてを使えます", // CP-1169
  colEmail: "メールアドレス", // CP-1170
  colRole: "役割", // CP-1171
  colActions: "操作", // CP-1172
  admin: "管理者", // CP-1173
  teacher: "先生", // CP-1174
  self: "あなた", // CP-1175
  addTitle: "先生を足す", // CP-1176
  emailLabel: "メールアドレス", // CP-1177
  add: "足す", // CP-1178
  makeAdmin: "管理者にする", // CP-1179
  makeTeacher: "先生にする", // CP-1180
  remove: "外す", // CP-1181
  confirmRemove: (email: string) => `${email}を外します。この人は、もう先生の画面に入れません`, // CP-1182
  cancel: "やめる", // CP-1183
  added: (email: string, role: string) => `${email}を${role}として足しました`, // CP-1184
  changed: (email: string, role: string) => `${email}を${role}にしました`, // CP-1185
  removed: (email: string) => `${email}を外しました`, // CP-1186
  off: "Google ログインが有効なときに使えます", // CP-1187
  notAdmin: "管理者だけが使えます", // CP-1188
  emailFormat: "メールアドレスの形を確かめてください", // CP-1189
  emailDomain: "学校のドメインの外のメールアドレスは足せません", // CP-1190
  failed: "操作できませんでした。少し待って、もう一度押してください", // CP-1191
  lastAdmin: "最後の管理者は、外せません。先に別の管理者を足してください", // CP-1192
  selfRemoval: "自分自身は、外せません。ほかの管理者に頼んでください", // CP-1193
  notFound: "指定の先生が見つかりません", // CP-1194
} as const;

// 学びの輪アシスタントの、承認の前と後の間違えの件数（#519）。CP-1431〜CP-1432。評価の言葉は書かない。正本は docs/design/ui/08_copy.md
export const LOOP_OCCURRENCE_COPY = {
  counts: (before: number, after: number) => `承認の前 ${before} 件 → 後 ${after} 件`, // CP-1431
  fewYet: "承認の前と後の件数は、まだ少ないので出しません", // CP-1432
} as const;

export const PROBLEM_ORDER_COPY = {
  title: "出題順を変える", // CP-1401
  lesson: "学習", // CP-1402
  intro: "問題を並べ替え、下のリンクを子どもに渡してください。", // CP-1403
  up: "上へ", // CP-1404
  down: "下へ", // CP-1405
  link: "練習用のリンク", // CP-1406
  open: "練習を開く", // CP-1407
  copy: "リンクをコピーする", // CP-1408
  copied: "リンクをコピーしました。", // CP-1409
  copyError: "コピーできませんでした。リンク欄からコピーしてください。", // CP-1410
  move: (position: number, direction: string) => `${position}問目を${direction}`, // CP-1411
  problem: "問題", // CP-1412
  order: "並べ替え", // CP-1413
} as const;

// 教材をつくる（SCR-T15、#374）。先生の画面では、研究用の言葉（mock・版・差分・根拠と出どころ）を使わない。
// /research/ の教材スタジオは、StudioPanel の既定（variant="research"）のまま
export const STUDIO_COPY = {
  title: "教材をつくる",
  mockNote: "見本の教材です。本物の AI がつくったものではありません",
  fallbackNote: "サーバーにつながらないため、見本の教材で続けています",
  approverNote: "承認キーは画面の上の欄に入れてください",
  turn: (number: number) => `${number} 回目`,
  current: (number: number) => `いまの教材：${number} 回目`,
  placed: (number: number) => `選んだ案を ${number} 回目の教材として置きました。承認してください`,
  approved: (number: number) => `${number} 回目の教材を承認しました`,
  revoked: (number: number) => `承認を取り消しました。${number} 回目の教材に戻しました`,
  madeNext: (number: number) => `${number} 回目の教材を作りました。内容を確かめてください`,
  state: (number: number, text: string) => `${number} 回目の状態：${text}`,
  makeNext: (number: number) => `${number} 回目を作る`,
  showDiff: "前との違いを見る",
  hideDiff: "違いを閉じる",
  diffTitle: (from: number, to: number) => `${from} 回目と ${to} 回目の違い`,
  diffStrategy: "教え方",
  moreTitle: "くわしい記録",
  moreSummary: "くわしい記録（つくった履歴と検査の結果）",
  evidenceTitle: "つくった記録",
  evidenceNote: "見本のデータを含みます。学習の効果は、まだ測っていません。",
  print: "印刷する",
  strategies: { visual: "図で考える", numeric: "数で考える", misconception: "つまずきから考える" },
} as const;

// 配った説明を取り下げる前の確認（#374。D-11 の「はじめからにする」と同じ形：押すと確認の枠を出し、「取り下げる」で実行、「やめる」で閉じる）
export const HANDOUT_WITHDRAW_COPY = {
  confirm: (text: string) => `「${text}」を取り下げます。子どもの画面から消えます`,
  withdraw: "取り下げる",
  cancel: "やめる",
} as const;
