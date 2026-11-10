## Cloud Vision OCR＋規則による読み取り（#334）

測定元: Cloud Vision `DOCUMENT_TEXT_DETECTION`。個別結果には写真や OCR の文章を含めず、正解したかと所要時間だけを記録。

方式 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%
--- | ---: | ---: | ---: | ---: | ---: | ---:
Cloud Vision OCR＋規則 全体 | 60 | 83.3% (40/48) | 10.0% (4/40) | 0.0% (0/12) | 0 ms | 0.02 ms
Cloud Vision OCR＋規則 ふつう | 15 | 83.3% (10/12) | 10.0% (1/10) | 0.0% (0/3) | 0 ms | 0.07 ms
Cloud Vision OCR＋規則 暗い | 15 | 83.3% (10/12) | 10.0% (1/10) | 0.0% (0/3) | 0 ms | 0.45 ms
Cloud Vision OCR＋規則 斜め | 15 | 83.3% (10/12) | 10.0% (1/10) | 0.0% (0/3) | 0 ms | 0.02 ms
Cloud Vision OCR＋規則 影 | 15 | 83.3% (10/12) | 10.0% (1/10) | 0.0% (0/3) | 0 ms | 0.02 ms
Gemini r2 全体 | 60 | 100.0% (48/48) | 100.0% (40/40) | 100.0% (12/12) | 1190.21 ms | 2130.7 ms

### 数の記載場所による内訳

判断が要る: `server/eval/print-images/*.json` の正解データには、数が問題文と図のどちらに記載されているかがありません。数値問題の総数（40問）は分かりますが、内訳は分類できません。

測定日時: 2026-11-09T23:37:09.548Z

図の中にしかない数は、この規則では読めないものとして数値の失敗に含めます。

| ID | 版 | 型正解 | 数値正解 | 不対応正解 | 時間 |
| --- | --- | --- | --- | --- | ---: |
| lever-01 | dark | true | true | 対象外 | 0.45 ms |
| lever-01 | normal | true | true | 対象外 | 0.07 ms |
| lever-01 | shadow | true | true | 対象外 | 0.02 ms |
| lever-01 | tilted | true | true | 対象外 | 0.02 ms |
| lever-02 | dark | true | false | 対象外 | 0.01 ms |
| lever-02 | normal | true | false | 対象外 | 0.01 ms |
| lever-02 | shadow | true | false | 対象外 | 0.01 ms |
| lever-02 | tilted | true | false | 対象外 | 0.01 ms |
| lever-03 | dark | true | false | 対象外 | 0.01 ms |
| lever-03 | normal | true | false | 対象外 | 0.03 ms |
| lever-03 | shadow | true | false | 対象外 | 0.01 ms |
| lever-03 | tilted | true | false | 対象外 | 0.01 ms |
| lever-04 | dark | true | false | 対象外 | 0 ms |
| lever-04 | normal | true | false | 対象外 | 0.02 ms |
| lever-04 | shadow | true | false | 対象外 | 0.01 ms |
| lever-04 | tilted | true | false | 対象外 | 0 ms |
| lever-05 | dark | true | false | 対象外 | 0 ms |
| lever-05 | normal | true | false | 対象外 | 0 ms |
| lever-05 | shadow | true | false | 対象外 | 0 ms |
| lever-05 | tilted | true | false | 対象外 | 0.01 ms |
| lever-06 | dark | true | false | 対象外 | 0 ms |
| lever-06 | normal | true | false | 対象外 | 0 ms |
| lever-06 | shadow | true | false | 対象外 | 0 ms |
| lever-06 | tilted | true | false | 対象外 | 0 ms |
| lever-07 | dark | true | false | 対象外 | 0.01 ms |
| lever-07 | normal | true | false | 対象外 | 0.01 ms |
| lever-07 | shadow | true | false | 対象外 | 0 ms |
| lever-07 | tilted | true | false | 対象外 | 0 ms |
| lever-08 | dark | true | false | 対象外 | 0 ms |
| lever-08 | normal | true | false | 対象外 | 0 ms |
| lever-08 | shadow | true | false | 対象外 | 0 ms |
| lever-08 | tilted | true | false | 対象外 | 0 ms |
| lever-09 | dark | true | false | 対象外 | 0 ms |
| lever-09 | normal | true | false | 対象外 | 0 ms |
| lever-09 | shadow | true | false | 対象外 | 0 ms |
| lever-09 | tilted | true | false | 対象外 | 0 ms |
| lever-10 | dark | true | false | 対象外 | 0 ms |
| lever-10 | normal | true | false | 対象外 | 0 ms |
| lever-10 | shadow | true | false | 対象外 | 0 ms |
| lever-10 | tilted | true | false | 対象外 | 0 ms |
| moon-01 | dark | false | 対象外 | 対象外 | 0 ms |
| moon-01 | normal | false | 対象外 | 対象外 | 0 ms |
| moon-01 | shadow | false | 対象外 | 対象外 | 0 ms |
| moon-01 | tilted | false | 対象外 | 対象外 | 0 ms |
| moon-02 | dark | false | 対象外 | 対象外 | 0 ms |
| moon-02 | normal | false | 対象外 | 対象外 | 0 ms |
| moon-02 | shadow | false | 対象外 | 対象外 | 0 ms |
| moon-02 | tilted | false | 対象外 | 対象外 | 0 ms |
| unsupported-01 | dark | false | 対象外 | false | 0.01 ms |
| unsupported-01 | normal | false | 対象外 | false | 0 ms |
| unsupported-01 | shadow | false | 対象外 | false | 0 ms |
| unsupported-01 | tilted | false | 対象外 | false | 0 ms |
| unsupported-02 | dark | false | 対象外 | false | 0 ms |
| unsupported-02 | normal | false | 対象外 | false | 0 ms |
| unsupported-02 | shadow | false | 対象外 | false | 0 ms |
| unsupported-02 | tilted | false | 対象外 | false | 0 ms |
| unsupported-03 | dark | false | 対象外 | false | 0 ms |
| unsupported-03 | normal | false | 対象外 | false | 0 ms |
| unsupported-03 | shadow | false | 対象外 | false | 0 ms |
| unsupported-03 | tilted | false | 対象外 | false | 0.01 ms |
