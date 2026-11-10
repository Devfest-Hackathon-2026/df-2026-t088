## Cloud Vision OCR＋規則による読み取り（#334）

測定元: Cloud Vision `DOCUMENT_TEXT_DETECTION`。個別結果には写真や OCR の文章を含めず、正解したかと所要時間だけを記録。

方式 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%
--- | ---: | ---: | ---: | ---: | ---: | ---:
Cloud Vision OCR＋規則 全体 | 40 | 97.1% (33/34) | 10.7% (3/28) | 0.0% (0/6) | 289.39 ms | 387.07 ms
Cloud Vision OCR＋規則 ふつう | 40 | 97.1% (33/34) | 10.7% (3/28) | 0.0% (0/6) | 289.39 ms | 387.07 ms
Cloud Vision OCR＋規則 暗い | 0 | 対象なし | 対象なし | 対象なし | 0 ms | 0 ms
Cloud Vision OCR＋規則 斜め | 0 | 対象なし | 対象なし | 対象なし | 0 ms | 0 ms
Cloud Vision OCR＋規則 影 | 0 | 対象なし | 対象なし | 対象なし | 0 ms | 0 ms

### 種類別

種類 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%
--- | ---: | ---: | ---: | ---: | ---: | ---:
decoy | 6 | 対象なし | 対象なし | 0.0% (0/6) | 269.22 ms | 869.27 ms
figure-only | 12 | 100.0% (12/12) | 0.0% (0/12) | 対象なし | 308.33 ms | 387.07 ms
moon-figure | 6 | 100.0% (6/6) | 対象なし | 対象なし | 221.28 ms | 256.82 ms
multi | 6 | 100.0% (6/6) | 50.0% (3/6) | 対象なし | 300.91 ms | 429.49 ms
paraphrase | 10 | 90.0% (9/10) | 0.0% (0/10) | 対象なし | 276.13 ms | 306.71 ms

### 数の記載場所による内訳

判断が要る: `server/eval/print-images/*.json` の正解データには、数が問題文と図のどちらに記載されているかがありません。数値問題の総数（40問）は分かりますが、内訳は分類できません。

測定日時: 2026-11-10T00:03:30.874Z

図の中にしかない数は、この規則では読めないものとして数値の失敗に含めます。

| ID | 版 | 型正解 | 数値正解 | 不対応正解 | 時間 |
| --- | --- | --- | --- | --- | ---: |
| decoy-01 | normal | false | 対象外 | false | 869.27 ms |
| decoy-02 | normal | false | 対象外 | false | 250.29 ms |
| decoy-03 | normal | false | 対象外 | false | 261 ms |
| decoy-04 | normal | false | 対象外 | false | 299.58 ms |
| decoy-05 | normal | false | 対象外 | false | 269.22 ms |
| decoy-06 | normal | false | 対象外 | false | 305.55 ms |
| figure-01 | normal | true | false | 対象外 | 314.42 ms |
| figure-02 | normal | true | false | 対象外 | 303.46 ms |
| figure-03 | normal | true | false | 対象外 | 319.94 ms |
| figure-04 | normal | true | false | 対象外 | 308.33 ms |
| figure-05 | normal | true | false | 対象外 | 387.07 ms |
| figure-06 | normal | true | false | 対象外 | 288.43 ms |
| figure-07 | normal | true | false | 対象外 | 289.39 ms |
| figure-08 | normal | true | false | 対象外 | 334.29 ms |
| figure-09 | normal | true | false | 対象外 | 279.94 ms |
| figure-10 | normal | true | false | 対象外 | 310.77 ms |
| figure-11 | normal | true | false | 対象外 | 302.83 ms |
| figure-12 | normal | true | false | 対象外 | 353.46 ms |
| moon-01 | normal | true | 対象外 | 対象外 | 256.82 ms |
| moon-02 | normal | true | 対象外 | 対象外 | 202.17 ms |
| moon-03 | normal | true | 対象外 | 対象外 | 248.64 ms |
| moon-04 | normal | true | 対象外 | 対象外 | 218.99 ms |
| moon-05 | normal | true | 対象外 | 対象外 | 243.7 ms |
| moon-06 | normal | true | 対象外 | 対象外 | 221.28 ms |
| multi-01 | normal | true | true | 対象外 | 429.49 ms |
| multi-02 | normal | true | false | 対象外 | 278.7 ms |
| multi-03 | normal | true | true | 対象外 | 300.91 ms |
| multi-04 | normal | true | false | 対象外 | 320.72 ms |
| multi-05 | normal | true | true | 対象外 | 301.8 ms |
| multi-06 | normal | true | false | 対象外 | 295.95 ms |
| phrase-01 | normal | true | false | 対象外 | 275.7 ms |
| phrase-02 | normal | false | false | 対象外 | 298.37 ms |
| phrase-03 | normal | true | false | 対象外 | 274.71 ms |
| phrase-04 | normal | true | false | 対象外 | 290.67 ms |
| phrase-05 | normal | true | false | 対象外 | 263.21 ms |
| phrase-06 | normal | true | false | 対象外 | 276.13 ms |
| phrase-07 | normal | true | false | 対象外 | 286.48 ms |
| phrase-08 | normal | true | false | 対象外 | 306.71 ms |
| phrase-09 | normal | true | false | 対象外 | 289.18 ms |
| phrase-10 | normal | true | false | 対象外 | 269.27 ms |
