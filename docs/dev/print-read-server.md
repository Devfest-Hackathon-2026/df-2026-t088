# プリント読み取りサーバ

`POST /api/v1/print/read` は、`multipart/form-data` の `image` を受け取り、JPEG のみを AI に渡します。写真はメモリ上で読み取り、ファイルには保存しません。画像は2MB以下、JPEG の SOF から読んだ長い辺が1600px以下であることを確かめます。この経路の本文上限は2.5MBで、ほかの `/api/v1` の本文上限8KBは変わりません。

## 読み取りと検査

Gemini には写真と、`rika-lever`・`rika-moon` の型一覧だけを渡します。指示では、問題文を先にそのまま写すこと、問題に書かれた数だけを使うこと、手書きの答えや人名を読まないこと、読めない文字を推測しないことを伝えます。構造化 JSON 出力では型 ID を2種類に限定します。出力の項目は問題文・型・てこの 3 つの数・不対応数・読めないかに絞ります。`params` を中身の決まらない object として書かせると空になりやすいので、てこの数は `leverLeftPos`・`leverLeftG`・`leverRightPos` の平らな項目で受け、サーバ側（`toPrintOutput`）で画面と同じ `params` に組み立てます。モデルが受け付けるか未確認の思考設定は指定していません。

サーバは型ごとの params を検査し、てこの答えが10から100までの10の倍数になることを確かめます。不正な問題と7問目以降を除き、`unsupportedCount` に加算します。形の間違い（型の一覧に無い、数が範囲外、文が空など）があったときだけ、理由を添えて1回だけ再試行します。型が無い問題や読めない写真は正しい答えなので、再試行しません（待ち時間が倍になり、無理に型へ当てはめる方向に誘うため）。再試行で説明できる問題が減ったら、前の結果を返します。AI 呼び出しは15秒以内、同時実行は2件、接続元あたり1分3回までです。

## ログと保存

記録するのは応答 `code`、所要時間、返した問題数です。写真、読み取った文、params、AI 例外の内容はログに出しません。画像データはリクエスト処理中のメモリだけで扱い、読み取り後に参照を手放します。

## 精度と速さを上げた工夫（#260）

本物の Gemini（`gemini-3.5-flash-lite`、`server/eval/run-print-eval.ts`、検証用の写真 60 枚、作り直しなしの 1 回勝負）で測りながら直した。

| 回 | 変えたこと | 型 | 数 | 型の無い問題を落とす | 時間 中央値 / 95% |
| --- | --- | ---: | ---: | ---: | ---: |
| r0 | #258 のまま | 89.6% | 87.5% | 83.3% | 1.60 / 2.22 秒 |
| r1 | 下の 1〜3 | 97.9% | 100% | 100% | 1.44 / 2.80 秒 |
| r2 | 下の 4 | 100% | 100% | 100% | 1.19 / 2.13 秒 |

1. **型に `none` を足した。** 数を持たない月の型が、型の無い問題（分数など）の受け皿になっていた。`none` を選ばせ、サーバで落として `unsupportedCount` に数える
2. **型ごとの言葉を問題文で確かめる。** てこは「支点・目もり・おもり・つり合」など、月は「月」のどれかが文に無ければ、型の取り違えとして落とす（作り直しは頼まない）
3. **てこの重さの読み落としを防ぐ指示。** 重さが「重さは30gです」のように別の文や図のおもりに書かれていても探すように書き、3 つの数を必ず書かせる
4. **考える量を最小（`thinkingLevel: MINIMAL`）にした。** 精度は落ちず、速くなった
5. **AI 側の一時的な失敗を 1 回だけ呼び直す。** r1 で 1 件、AI の応答エラーがあった。時間切れは呼び直さない

**限界：** 写真はチームで作った印刷の画面写しで、紙をスマホで撮った写真ではない。手書きの文字、ピンぼけ、紙の折れは測っていない。スマホでの確認は #263。

## スマホで撮った写真に近い条件と、遅い回への備え

検証用の写真（ふつうの版の 15 問）を、ぼかし・遠近（紙を斜め上から撮った形）・暖色の照明・遠くから小さく撮った形・強い JPEG 圧縮に崩して 45 枚にし、本物の Gemini で測った（2026-11-10）。

- AI を直接呼ぶ測り方：型 35/36、数 29/29、型の無い問題を落とす 9/9。中央値は約 1.6 秒。ただし、まれに **15〜30 秒かかる回があった**（95% の値が 15〜30 秒、1 件は 30 秒で打ち切り）
- そこで、AI が 5 秒（`LIMITS.printHedgeAfterMilliseconds`）までに返らなければ、同じ頼みをもう 1 本だけ出し、早く返った方を使うようにした（hedged request）。残り時間が 2 秒より少ないときは出さない。終わったら残りの呼び出しは中断する。ふだん（1〜2 秒で返る）は 1 本だけで、AI の呼び出しは増えない
- サーバの経路（検査・作り直し・予備の呼び出し込み）を通した測り直し：45/45 正解、中央値 1.16 秒、95% 1.84 秒、最大 2.19 秒（この回は遅い回が出なかったので、予備の呼び出しが効いた数は測れていない。動きはテストで確かめた）

限界：崩した写真は画面写しを加工したもので、紙をスマホで撮った写真ではない。手書き・紙の折れ・指の写り込みは未確認。

## 紙を撮った写真の評価（#328）

紙に印刷した問題をスマートフォンで撮り、実写用の未調整データとして測る。最初の数字を記録し、評価結果を見てから同じ写真で指示や検査を調整しない。調整した場合は別の写真を集め、新しい評価として測る。

### 写真と正解

- 50〜100 枚を集める。実際に使う端末ごとに、できれば複数の問題と撮影条件を含める。端末名は機種の短い名前（例: `Pixel 8a`、`iPhone 16`）で記録する
- 印刷した紙を机などに置き、普段の室内照明で撮る。問題全体が入り、文字が読める距離を基本にする。手書き、折れ、指、影などを含む写真も意図して撮り、該当する条件を記録する。顔、氏名、学校名など個人が分かるものは写さない
- 写真は `server/eval/real-photos/` に `.jpg` で置く。ファイル名は重複しない名前にする。このフォルダは Git の対象外
- `answers.csv` に1枚1行で正解を書く。列は `file,templateId,leftPosition,leftWeight,rightPosition,device,conditions`。`templateId` は `rika-lever`、`rika-moon`、または不対応問題の `none`。てこ以外の数の欄は空にし、条件は `|` 区切り（例: `handwriting|shadow`）にする
- CSV から同じフォルダに正解 JSON を作る。正解 JSON と写真も Git に入れない

```sh
cd server
node eval/make-real-photo-answers.mjs
```

生成後、実物の紙と照らして全ての正解を人が確認する。条件名は任意だが、端末名と条件名は同じ表記にそろえる。

### 実行と結果

本物の Gemini を使う測定は担当者が手動で実施する。`--images` を付けると既定の60枚制限を使わず、指定フォルダの `.jpg` と同名 `.json` を全て測る。結果の Markdown だけが `eval/results/` に保存される。写真、読み取った文、params は結果とログに出さない。

```sh
cd server
node eval/run-print-eval.ts --images eval/real-photos --output eval/results/print-photo-first
```

必要なら結果名を変える。最初の評価を保存したら、調整前の結果として保管する。テストでは実在の画像見本と `--mock` を使い、本物の Gemini は呼ばない。

Markdown には全体・端末別・条件別の件数と正解率、および「検算を通った誤読」の数が出る。これは型と問題文の照合、サーバの `validatePrintOutput` を通過して説明として残った問題のうち、てこの数が正解と異なる件数を示す。

## 画像の読み方（mediaResolution）と費用（2026-11-10）

画像をどの細かさで読むか（`mediaResolution`）を変えて、本物の Gemini で測った（写真 60 枚＋スマホ写真に近く加工した 45 枚、作り直しなしの 1 回勝負、各 1 回）。

| 設定 | 正解 | 入力トークン（1 回の平均） | 出力トークン | 待ち 中央値 |
| --- | ---: | ---: | ---: | ---: |
| 指定なし（今まで） | 104/105 | 2005 | 100 | 1.22 秒 |
| HIGH | 101/105 | 2005 | 100 | 1.60 秒 |
| **MEDIUM（採用）** | **105/105** | **1476** | 93 | 1.41 秒 |
| LOW | 104/105 | 1191 | 93 | 1.28 秒 |

MEDIUM は精度が落ちず（この回は全問正解）、入力が約 26% 減る。LOW はさらに減るが 1 問落とした。1 回ずつの測定なので、差の一部は揺れの範囲。

費用の目安（料金は第三者の集計の値で、公式の料金表では未確認：入力 100 万トークンあたり $0.30、出力 $2.50）：MEDIUM で 1 回あたり約 $0.00068（1 ドル 150 円で約 0.1 円）。100 万回読んで約 10 万円。
## Cloud Vision OCR＋規則の評価（#334）

`cd server; node eval/run-print-ocr-baseline.ts` を実行すると、60枚を Cloud Vision の `DOCUMENT_TEXT_DETECTION` に送り、型とてこの数を規則で読み取ります。結果は `server/eval/results/print-ocr-baseline.md` に保存されます。写真と OCR で読んだ文章は保存せず、正解したかと時間だけを記録します。

モックを試すときは `cd server; node eval/run-print-ocr-baseline.ts --mock` を実行します。見本の Vision 応答 JSON を全件に使い、`print-ocr-baseline-mock.md` に出力します。この数値は Cloud Vision の測定結果ではありません。

### 実測の準備と実行

1. Google Cloud で Cloud Vision API を有効にし、利用するプロジェクトの課金設定と無料枠を人が確認します。
2. `gcloud auth application-default login` または `gcloud auth login` で認証します。スクリプトは `gcloud auth application-default print-access-token` を先に試し、利用できない場合は `gcloud auth print-access-token` を使います。トークンはファイルに保存しません。
3. PowerShell では `$env:OCR_PROJECT = "課金に使う Google Cloud プロジェクト ID"` を設定し、`cd server` のあと `node eval/run-print-ocr-baseline.ts` を実行します。`OCR_PROJECT` は REST の `x-goog-user-project` に使われます。
4. 完了したら `server/eval/results/print-ocr-baseline.md` の集計を確認します。API が返す文章や例外の内容は評価結果に書きません。

Cloud Vision の有効化と課金設定は人が行ってください。60枚は無料枠の範囲を想定していますが、実際の無料枠・課金条件は Google Cloud のプロジェクト設定で確認してください。

## 難しい検証セット（#342）

`server/eval/make-hard-print-images.mjs` は、既存の画像生成と同じ Playwright と SVG を使い、チーム内で作った問題画像40枚と同名の正解 JSON を `server/eval/print-images-hard/` に作ります。40枚の内訳は、図だけに数があるてこ12問、言い回しが異なるてこ10問、複数問題からてこを選ぶもの6問、図だけの月6問、言葉が紛らわしい不対応問題6問です。各 JSON の `category` で種類を記録します。

作り直すときはリポジトリのルートから実行します。生成物は評価用データなので、内容を変える場合は画像と JSON の両方を確認してください。

```sh
node server/eval/make-hard-print-images.mjs
```

Cloud Vision OCR のモック評価は、サーバのディレクトリから次のように実行します。結果は指定先の Markdown に書き、種類別の集計表を含みます。モックは見本の OCR 応答を全画像に使うため、難しい画像を読んだ実測値ではありません。

```sh
cd server
node eval/run-print-ocr-baseline.ts --mock --images eval/print-images-hard --output eval/results/print-ocr-hard-mock.md
```

人が実測するときは `--mock` を外します。Cloud Vision の設定と課金を確認してから実行してください。

```sh
cd server
node eval/run-print-ocr-baseline.ts --images eval/print-images-hard --output eval/results/print-ocr-hard-first.md
node eval/run-print-eval.ts --images eval/print-images-hard --output eval/results/print-hard-first
```

Gemini の `--mock` 評価も確認できます。実測結果は担当者が種類別の表で比較し、差が出ない場合もそのまま記録します。

```sh
cd server
node eval/run-print-eval.ts --mock --images eval/print-images-hard --output eval/results/print-hard-mock
```
