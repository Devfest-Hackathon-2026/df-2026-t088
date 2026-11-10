# 教育アプリ API サーバ

Node.js 24 以降が必要です。

```sh
npm install
npm run dev
```

テストと型チェックは `npm test`、`npm run typecheck` で実行します。

## 環境変数

サーバは `.env` を自動では読みません。使うときは Node の `--env-file` で渡します。`.env.example` を写して値を入れてください。`.env` は git に入れません。

```sh
cp .env.example .env
node --env-file=.env src/server.ts
```

`PORT=` のように空の項目は、未設定と同じに扱います（`PORT` の既定は 8080）。

## 学級（ワークスペース）

先生が Google で入ると、自分の学級ができます。配った説明はその学級に入り、子どもは学級コードで見ます。決まりの正本は `docs/product/education-api-contract.md` の「学級（ワークスペース）の API」です。ログインの設定は `docs/dev/teacher-login.md` を見てください。

足した設定（名前だけ。値は書きません）:

| 名前 | 何か |
| --- | --- |
| `TEACHER_SIGNUP` | `open` のとき、名簿に無い Google アカウントも先生として入れて、学級ができます。`TEACHER_LOGIN=on` のときだけ効きます。このとき `ADMIN_EMAILS`・`TEACHER_EMAILS` が空でも起動します。未設定なら名簿の人だけです |
| `WORKSPACE_READS_PER_DAY` | 1 つの学級が 1 日にプリントを読み取れる回数（日本時間の日付で数えます）。既定は 30 |

Google を使わずに学級を作る設定（公開デモ用）: `TEACHER_LOGIN=guest` と `PUBLIC_BASE_URL` だけで起動できます（Google の設定、名簿、`SESSION_SECRET` は要りません。`SESSION_SECRET` が無ければ起動のたびに乱数で作ります）。`POST /api/v1/teacher/guest` で「お試しの学級」ができます（`Origin` が `PUBLIC_BASE_URL` と同じときだけ。1 つの接続元から 1 日 10 個まで）。guest の学級は Firestore に保存しません（メモリだけ）。

| 名前 | 何か |
| --- | --- |
| `PRINT_READS_PER_DAY_TOTAL` | 全学級の合計の、プリントの読み取りの 1 日の回数（日本時間）。既定は 500 |
| `GUEST_WORKSPACES_PER_HOUR` | 全体で 1 時間に作れるお試しの学級の数。既定は 200。guest の学級は Firestore に保存しません（メモリだけ） |
| `STUDIO_AI_PER_DAY_TOTAL` | 教材スタジオの Gemini を呼ぶ POST の全体の 1 日の回数。既定は 200 |
| `LOOP_AI_PER_DAY_TOTAL` | 全学級の合計の、学びの輪のアシスタントが Gemini を呼ぶ 1 日の回数（日本時間）。既定は 300 |

動かし方（開発）: `TEACHER_LOGIN=on`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`PUBLIC_BASE_URL`（開発は `http://localhost:8080`）、`SESSION_SECRET` と `TEACHER_SIGNUP=open` を `.env` に入れて起動します。

- ログインの Cookie は `__session` の 1 つだけです（Firebase Hosting が Cloud Run に渡す名前のため）。
- `__session` の付いた GET・HEAD 以外の要求は、`Origin` が `PUBLIC_BASE_URL` と違うと 403 です。
- 学級は、`PRINT_FIRESTORE_DATABASE` と `GOOGLE_CLOUD_PROJECT` があれば Firestore（`workspaces` と `workspaceReads`）にも保存し、再起動しても残ります。起動時に全部読み込み、終わる（または失敗する）まで学級に触る経路は待たされ、失敗したら 503 を返します。どちらかが無ければメモリだけで、再起動すると消えます（先生はもういちど入ると、新しい学級ができます）。メールは保存せず、持ち主はメールから作った印だけです。

## Gemini とモック

| `GEMINI_MODE` | `GEMINI_MODEL` | 動き |
| --- | --- | --- |
| 未設定または空 | 問わない | モックで起動する（reason: `mode_missing`） |
| `developer` または `vertex` | なし | モックで起動する（reason: `model_missing`） |
| `developer` または `vertex` | あり | Gemini を使う。必要な項目が足りなければ起動に失敗する |
| 上のどちらでもない値 | 問わない | 綴り間違いとして起動に失敗する |

モックで起動したときは、起動時のログに `running with mock AI (reason: ...)` と出ます。Gemini のつもりで起動してこの行が出たら、`GEMINI_MODE` か `GEMINI_MODEL` の設定漏れです。

## 入力の上限（仮）

式の分子・分母は 1000 まで（`src/limits.ts` の `maxFractionTerm`）。分子が 0 の式と、答えが負になる式は、AI を呼ばずに `INVALID_REQUEST`（400）を返します。

## 部品化の精度を測る

既定ではモック AI を使い、`server/eval/problems.json` の24問を評価します。

```sh
npm run eval:parts
npm run eval:parts -- --limit 5
npm run eval:parts -- --out parts-eval.json
```

表には、どの AI で測ったか（mode と model。鍵は出さない）、成功率、初回成功率、作り直し後の成功率、エラー code ごとの件数、処理時間の中央値と最大を表示します。成功した応答については、単位分数の分母が式の分母の最小公倍数と一致するか、ヒント数も目安として記録します。`--out <ファイル>` を付けると同じ結果（`ai` の欄を含む）を JSON に保存します。書き先に書けないときは、AI を呼ぶ前に止まります。問題が0問のときも止まります。アクセスログは標準エラーに出るので、表だけを標準出力から取れます。

本物の Gemini で実行するには `GEMINI_MODE=developer` または `GEMINI_MODE=vertex` と `GEMINI_MODEL` を設定し、実行時に `EVAL_ALLOW_REAL_AI=1` も明示してください。許可変数が無いと AI を呼ぶ前に停止します。`EVAL_ALLOW_REAL_AI=1` なのに設定がモックになる場合（`GEMINI_MODEL` の設定漏れなど）も、AI を呼ぶ前に停止します。本物の呼び出しは料金が発生します。また、小学生を対象とする利用の規約上の問題は未解決です。実行前に、リポジトリの根の `research_notes/gemini-terms-minors.md` の確認事項を確認してください（このファイルは PR #26 が merge されるまで main にありません）。モデル ID は `GEMINI_MODEL` で指定します。
