## Cloud Vision OCR＋規則による読み取り（#334）

測定元: Cloud Vision `DOCUMENT_TEXT_DETECTION`。個別結果には写真や OCR の文章を含めず、正解したかと所要時間だけを記録。

方式 | 問題数 | 型正解率 | 数値正解率 | 不対応の除外率 | 時間 中央値 | 時間 95%
--- | ---: | ---: | ---: | ---: | ---: | ---:
Cloud Vision OCR＋規則 全体 | 60 | 100.0% (48/48) | 100.0% (40/40) | 100.0% (12/12) | 294.32 ms | 338.18 ms
Cloud Vision OCR＋規則 ふつう | 15 | 100.0% (12/12) | 100.0% (10/10) | 100.0% (3/3) | 296 ms | 338.18 ms
Cloud Vision OCR＋規則 暗い | 15 | 100.0% (12/12) | 100.0% (10/10) | 100.0% (3/3) | 266.39 ms | 479.79 ms
Cloud Vision OCR＋規則 斜め | 15 | 100.0% (12/12) | 100.0% (10/10) | 100.0% (3/3) | 315.44 ms | 366.89 ms
Cloud Vision OCR＋規則 影 | 15 | 100.0% (12/12) | 100.0% (10/10) | 100.0% (3/3) | 298.88 ms | 330.44 ms
Gemini r2 全体 | 60 | 100.0% (48/48) | 100.0% (40/40) | 100.0% (12/12) | 1190.21 ms | 2130.7 ms

### 数の記載場所による内訳

判断が要る: `server/eval/print-images/*.json` の正解データには、数が問題文と図のどちらに記載されているかがありません。数値問題の総数（40問）は分かりますが、内訳は分類できません。

測定日時: 2026-11-09T23:47:30.587Z

図の中にしかない数は、この規則では読めないものとして数値の失敗に含めます。

| ID | 版 | 型正解 | 数値正解 | 不対応正解 | 時間 |
| --- | --- | --- | --- | --- | ---: |
| lever-01 | dark | true | true | 対象外 | 479.79 ms |
| lever-01 | normal | true | true | 対象外 | 319.05 ms |
| lever-01 | shadow | true | true | 対象外 | 296.52 ms |
| lever-01 | tilted | true | true | 対象外 | 297.22 ms |
| lever-02 | dark | true | true | 対象外 | 283.96 ms |
| lever-02 | normal | true | true | 対象外 | 297.96 ms |
| lever-02 | shadow | true | true | 対象外 | 280.17 ms |
| lever-02 | tilted | true | true | 対象外 | 330.35 ms |
| lever-03 | dark | true | true | 対象外 | 266.39 ms |
| lever-03 | normal | true | true | 対象外 | 304.63 ms |
| lever-03 | shadow | true | true | 対象外 | 315.9 ms |
| lever-03 | tilted | true | true | 対象外 | 366.89 ms |
| lever-04 | dark | true | true | 対象外 | 303.03 ms |
| lever-04 | normal | true | true | 対象外 | 315.71 ms |
| lever-04 | shadow | true | true | 対象外 | 302.2 ms |
| lever-04 | tilted | true | true | 対象外 | 326.38 ms |
| lever-05 | dark | true | true | 対象外 | 259.41 ms |
| lever-05 | normal | true | true | 対象外 | 303.7 ms |
| lever-05 | shadow | true | true | 対象外 | 321.2 ms |
| lever-05 | tilted | true | true | 対象外 | 356.69 ms |
| lever-06 | dark | true | true | 対象外 | 268.08 ms |
| lever-06 | normal | true | true | 対象外 | 296 ms |
| lever-06 | shadow | true | true | 対象外 | 284.62 ms |
| lever-06 | tilted | true | true | 対象外 | 323.81 ms |
| lever-07 | dark | true | true | 対象外 | 259.21 ms |
| lever-07 | normal | true | true | 対象外 | 292.93 ms |
| lever-07 | shadow | true | true | 対象外 | 327.09 ms |
| lever-07 | tilted | true | true | 対象外 | 320.19 ms |
| lever-08 | dark | true | true | 対象外 | 268.27 ms |
| lever-08 | normal | true | true | 対象外 | 294.32 ms |
| lever-08 | shadow | true | true | 対象外 | 316.01 ms |
| lever-08 | tilted | true | true | 対象外 | 325.15 ms |
| lever-09 | dark | true | true | 対象外 | 270.43 ms |
| lever-09 | normal | true | true | 対象外 | 338.18 ms |
| lever-09 | shadow | true | true | 対象外 | 310.68 ms |
| lever-09 | tilted | true | true | 対象外 | 286.58 ms |
| lever-10 | dark | true | true | 対象外 | 248.93 ms |
| lever-10 | normal | true | true | 対象外 | 306.75 ms |
| lever-10 | shadow | true | true | 対象外 | 298.88 ms |
| lever-10 | tilted | true | true | 対象外 | 315.44 ms |
| moon-01 | dark | true | 対象外 | 対象外 | 225.33 ms |
| moon-01 | normal | true | 対象外 | 対象外 | 253.79 ms |
| moon-01 | shadow | true | 対象外 | 対象外 | 330.44 ms |
| moon-01 | tilted | true | 対象外 | 対象外 | 312.06 ms |
| moon-02 | dark | true | 対象外 | 対象外 | 253.94 ms |
| moon-02 | normal | true | 対象外 | 対象外 | 290.54 ms |
| moon-02 | shadow | true | 対象外 | 対象外 | 273.67 ms |
| moon-02 | tilted | true | 対象外 | 対象外 | 284.89 ms |
| unsupported-01 | dark | true | 対象外 | true | 269.74 ms |
| unsupported-01 | normal | true | 対象外 | true | 252.23 ms |
| unsupported-01 | shadow | true | 対象外 | true | 264.87 ms |
| unsupported-01 | tilted | true | 対象外 | true | 255.56 ms |
| unsupported-02 | dark | true | 対象外 | true | 235.76 ms |
| unsupported-02 | normal | true | 対象外 | true | 238.59 ms |
| unsupported-02 | shadow | true | 対象外 | true | 286.15 ms |
| unsupported-02 | tilted | true | 対象外 | true | 313.59 ms |
| unsupported-03 | dark | true | 対象外 | true | 232.44 ms |
| unsupported-03 | normal | true | 対象外 | true | 243.57 ms |
| unsupported-03 | shadow | true | 対象外 | true | 272.02 ms |
| unsupported-03 | tilted | true | 対象外 | true | 275.28 ms |
