import { describe, expect, it } from "vitest";
import { CSV_PATH, MAX_ITEMS, bodyOf, readCodeTable, tidy } from "../../scripts/build-curriculum.mjs";
import type { CodeRow } from "../../scripts/build-curriculum.mjs";
import { plainText, parseRuby, displayText } from "../ruby-text";
import { ALL_CHAPTERS, chaptersOf, findAnyChapter, shownSubjectsOf, subjectsOfGrade } from "./courses";
import { CHAPTERS } from "./chapters";
import { CURRICULUM } from "./curriculum";
import { GENERATED_CHAPTERS } from "./curriculum-items";
import { GRADES } from "./kanji-grades";
import { KID_CELL_NAMES, applyKidNames } from "./kid-cell-names";
import type { Grade } from "./kanji-grades";
import { KOKUGO_CHAPTERS } from "./kokugo";
import type { Chapter, SubjectId } from "./types";

// ---- コード表の読み。生成スクリプトとは別に、末端と柱書きを数え直す（NFR-002） ----

// コード表（research_notes/curriculum/）は開発用の repo にだけあり、提出用のコピーには入らない（#152）。
// 無いときは、コード表と照らし合わせる試験だけを飛ばす。開発用の repo の CI では必ず全部を回す
// @types/node が無いので、fs は文字列をつないで読み込む（wording.test.ts と同じ）
const { existsSync } = (await import(/* @vite-ignore */ "node:" + "fs")) as { existsSync: (path: string) => boolean };
const HAS_CODE_TABLE = existsSync(CSV_PATH);
const itWithCodeTable = it.skipIf(!HAS_CODE_TABLE);
const ROWS = HAS_CODE_TABLE ? readCodeTable() : [];
const BY_CODE = new Map<string, CodeRow>(ROWS.map((row) => [row.code, row]));
const prefix = (code: string): string => code.replace(/0+$/, "");

/** コードの末尾の0を除いた部分で、もう1つ短い所から、最も近い存在する行 */
function parentRow(row: CodeRow): CodeRow | undefined {
  const byPrefix = new Map(ROWS.map((candidate) => [prefix(candidate.code), candidate]));
  for (let p = prefix(row.code).slice(0, -1); p.length > 0; p = p.slice(0, -1)) {
    const found = byPrefix.get(p);
    if (found) return found;
  }
  return undefined;
}

/** 章のコードの下の末端：その行を前置きに持つ行のうち、自分を前置きに持つ行が他に無い物。下が無ければ自分 */
function leavesUnder(code: string): CodeRow[] {
  const under = ROWS.filter((row) => row.code !== code && row.code.startsWith(prefix(code)));
  if (under.length === 0) return [BY_CODE.get(code)!];
  return under.filter((row) => !ROWS.some((other) => other.code !== row.code && other.code.startsWith(prefix(row.code))));
}

const SUBJECT_ORDER: SubjectId[] = ["kokugo", "sansu", "rika", "shakai", "eigo", "ongaku", "taiiku", "zuko", "katei", "seikatsu"];

/**
 * 学年×教科のマスの数（04_functional_spec.md FR-005 の表）。ない教科は 0。
 * 5年算数だけは表の 37 と合わない。コード表から数えると 43 で、表の 1,122 も 1,128 になる（設計書の数え違いと見て報告した）。ここは 43
 */
const FR005: Record<Grade, Record<SubjectId, number>> = {
  1: { kokugo: 39, sansu: 25, rika: 0, shakai: 0, eigo: 0, ongaku: 21, taiiku: 26, zuko: 7, katei: 0, seikatsu: 9 },
  2: { kokugo: 39, sansu: 30, rika: 0, shakai: 0, eigo: 0, ongaku: 21, taiiku: 26, zuko: 7, katei: 0, seikatsu: 9 },
  3: { kokugo: 42, sansu: 43, rika: 23, shakai: 14, eigo: 9, ongaku: 21, taiiku: 32, zuko: 7, katei: 0, seikatsu: 0 },
  4: { kokugo: 42, sansu: 49, rika: 25, shakai: 19, eigo: 9, ongaku: 21, taiiku: 32, zuko: 7, katei: 0, seikatsu: 0 },
  5: { kokugo: 44, sansu: 43, rika: 24, shakai: 29, eigo: 17, ongaku: 21, taiiku: 36, zuko: 7, katei: 33, seikatsu: 0 },
  6: { kokugo: 44, sansu: 27, rika: 31, shakai: 23, eigo: 17, ongaku: 21, taiiku: 35, zuko: 7, katei: 33, seikatsu: 0 },
};

const curriculumOf = (grade: Grade, subjectId: SubjectId) =>
  CURRICULUM.find((entry) => entry.grade === grade)?.subjects.find((subject) => subject.subjectId === subjectId);

/** 5年算数と国語の漢字の章は、構造を手で持つ。それ以外が生成した章 */
const GENERATED_IDS = new Set(GENERATED_CHAPTERS.map((chapter) => chapter.id));
const isGenerated = (chapter: Chapter): boolean => GENERATED_IDS.has(chapter.id);

const itemCount = (chapters: readonly Chapter[]): number => chapters.reduce((sum, chapter) => sum + chapter.items.length, 0);

describe("学年ごとの教科（FR-001）", () => {
  it("教科の数は 6・6・8・8・9・9", () => {
    expect(GRADES.map((grade) => subjectsOfGrade(grade).length)).toEqual([6, 6, 8, 8, 9, 9]);
  });

  it("1・2年は生活を持ち、3年以上は持たない。並びは教科の順", () => {
    expect(subjectsOfGrade(1)).toEqual(["kokugo", "sansu", "ongaku", "taiiku", "zuko", "seikatsu"]);
    expect(subjectsOfGrade(3)).not.toContain("seikatsu");
    for (const grade of GRADES) {
      const ids = subjectsOfGrade(grade);
      expect(ids).toEqual(SUBJECT_ORDER.filter((id) => ids.includes(id)));
    }
  });

  it("実施されない教科の章は空で、同じ配列を返す", () => {
    expect(chaptersOf(1, "rika")).toEqual([]);
    expect(chaptersOf(1, "rika")).toBe(chaptersOf(1, "rika"));
    expect(chaptersOf(3, "sansu")).toBe(chaptersOf(3, "sansu"));
  });

  it("ALL_CHAPTERS は学年と教科の表の章を全部持ち、id から引ける", () => {
    expect(ALL_CHAPTERS.length).toBe(GRADES.flatMap((grade) => subjectsOfGrade(grade).flatMap((id) => chaptersOf(grade, id))).length);
    expect(new Set(ALL_CHAPTERS.map((chapter) => chapter.id)).size).toBe(ALL_CHAPTERS.length);
    for (const chapter of ALL_CHAPTERS) expect(findAnyChapter(chapter.id)).toBe(chapter);
    expect(findAnyChapter("nothing")).toBeUndefined();
  });
});

describe("章（FR-003）", () => {
  it("id は {教科}-{学年}-{番号2桁}、分けた章は -1 -2。学年・教科・順番の有無が章と CURRICULUM で合う", () => {
    for (const chapter of ALL_CHAPTERS) {
      if (CHAPTERS.includes(chapter) || KOKUGO_CHAPTERS.includes(chapter)) continue;
      expect(chapter.id).toMatch(new RegExp(`^${chapter.subjectId}-${chapter.grade}-\\d{2}(-\\d)?$`));
    }
    for (const chapter of ALL_CHAPTERS) {
      expect(chaptersOf(chapter.grade, chapter.subjectId)).toContain(chapter);
      expect(chapter.ordered).toBe(curriculumOf(chapter.grade, chapter.subjectId)?.isOrdered);
    }
  });

  it("章の並びは CURRICULUM のまま。国語5年だけ漢字の章が「言葉の特徴や使い方」の次に入る", () => {
    for (const grade of GRADES) {
      for (const subjectId of subjectsOfGrade(grade)) {
        if (grade === 5 && subjectId === "sansu") continue;
        const names = chaptersOf(grade, subjectId)
          .filter((chapter) => chapter.id !== "kokugo-kanji-5")
          // 章の名前を短くした章（kid-cell-names の tab・title）は、生成した元の名前で並びを見る
          .map((chapter) => plainText((GENERATED_CHAPTERS.find((generated) => generated.id === chapter.id) ?? chapter).title).replace(/（\d）$/, ""));
        const expected = curriculumOf(grade, subjectId)?.chapters.flatMap((chapter) => (chapter.name ? [chapter.name] : [])) ?? [];
        expect([...new Set(names)]).toEqual(expected);
      }
    }
    expect(chaptersOf(5, "kokugo").map((chapter) => chapter.id)).toEqual([
      "kokugo-5-01", "kokugo-kanji-5", "kokugo-5-02", "kokugo-5-03", "kokugo-5-04", "kokugo-5-05", "kokugo-5-06",
    ]);
    expect(chaptersOf(6, "kokugo").some((chapter) => chapter.id === "kokugo-kanji-5")).toBe(false);
  });

  it("算数の分野は記号の頭の文字から決まる（Cは変化と関係の分野）", () => {
    const domain = { A: "number", B: "shape", C: "change", D: "data" } as const;
    for (const chapter of ALL_CHAPTERS.filter((entry) => isGenerated(entry) && entry.subjectId === "sansu")) {
      expect(chapter.domain).toBe(domain[chapter.sources[0]![0] as keyof typeof domain]);
    }
    expect(ALL_CHAPTERS.filter((chapter) => isGenerated(chapter) && chapter.subjectId !== "sansu").every((chapter) => chapter.domain === undefined)).toBe(true);
  });

  it("生活は 1・2年に内容のまとまり3つ。章は全部最初から開く教科", () => {
    for (const grade of [1, 2] as const) {
      const chapters = chaptersOf(grade, "seikatsu");
      expect(chapters.map((chapter) => chapter.id)).toEqual([`seikatsu-${grade}-01`, `seikatsu-${grade}-02`, `seikatsu-${grade}-03`]);
      expect(chapters.map((chapter) => chapter.items.length)).toEqual([3, 5, 1]);
      expect(chapters.every((chapter) => !chapter.ordered)).toBe(true);
      expect(chapters.flatMap((chapter) => chapter.items.map((item) => item.source))).toEqual(["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)"]);
    }
  });
});

describe("マス（FR-005）", () => {
  it("1章のマスは9まで。5年算数の既存の章も9以下なので除外しない", () => {
    expect(MAX_ITEMS).toBe(9);
    for (const chapter of ALL_CHAPTERS) {
      expect(chapter.items.length).toBeGreaterThan(0);
      expect(chapter.items.length).toBeLessThanOrEqual(MAX_ITEMS);
    }
    expect(Math.max(...CHAPTERS.map((chapter) => chapter.items.length))).toBe(9);
  });

  itWithCodeTable("9を超える章は ceil(数÷9) 個に分ける（6年社会は 7＋6）", () => {
    const parts = chaptersOf(6, "shakai").filter((chapter) => chapter.id.startsWith("shakai-6-02"));
    expect(parts.map((chapter) => chapter.id)).toEqual(["shakai-6-02-1", "shakai-6-02-2"]);
    expect(parts.map((chapter) => chapter.items.length)).toEqual([7, 6]);
    expect(parts.map((chapter) => plainText(chapter.title))).toEqual(["我が国の歴史上の主な事象（1）", "我が国の歴史上の主な事象（2）"]);
    // 分けた章は、コード表の順を保って末端を1つずつ持つ
    expect(parts.flatMap((chapter) => chapter.items.map((item) => item.codes[0]))).toEqual(
      leavesUnder(curriculumOf(6, "shakai")!.chapters[1]!.codes[0]!).map((row) => row.code),
    );
    expect(GENERATED_CHAPTERS.filter((chapter) => /-\d$/.test(chapter.id)).length).toBe(2);
  });

  itWithCodeTable("学年×教科のマスの数は、FR-005 の表と同じ（5年算数は表の 37 でなく 43。手で持つ13章のマスは 56）", () => {
    for (const grade of GRADES) {
      for (const subjectId of SUBJECT_ORDER) {
        const chapters = chaptersOf(grade, subjectId);
        if (grade === 5 && subjectId === "sansu") {
          const ends = curriculumOf(5, "sansu")!.chapters.flatMap((chapter) => chapter.codes).flatMap((code) => leavesUnder(code).filter((row) => !/^8250253[6-9]/.test(row.code)));
          expect(ends.length).toBe(FR005[5].sansu);
          expect(itemCount(chapters)).toBe(56);
        } else {
          expect(itemCount(chapters.filter((chapter) => chapter.id !== "kokugo-kanji-5")), `${grade}年 ${subjectId}`).toBe(FR005[grade][subjectId]);
        }
      }
    }
    const nonLife = GRADES.flatMap((grade) => SUBJECT_ORDER.filter((id) => id !== "seikatsu").map((id) => FR005[grade][id]));
    expect(nonLife.reduce((sum, count) => sum + count, 0)).toBe(1128);
  });

  itWithCodeTable("末端の漏れも重複も無い（コード表の末端と、順まで同じ。〔用語・記号〕はマスにしない）", () => {
    for (const grade of GRADES) {
      for (const subjectId of subjectsOfGrade(grade)) {
        if (grade === 5 && subjectId === "sansu") continue;
        const generated = chaptersOf(grade, subjectId).filter(isGenerated);
        const expected = curriculumOf(grade, subjectId)!.chapters.flatMap((chapter) => chapter.codes.flatMap((code) => leavesUnder(code).map((row) => row.code)));
        const actual = generated.flatMap((chapter) => chapter.items.flatMap((item) => item.codes));
        expect(actual, `${grade}年 ${subjectId}`).toEqual(expected);
        expect(new Set(actual).size).toBe(actual.length);
        for (const code of actual) expect(BY_CODE.get(code)?.text.startsWith("〔用語・記号〕")).toBe(false);
      }
    }
  });

  itWithCodeTable("記号を外した本文が title と learn になる（生成した章。子ども向けの名前は kid-cell-names で当てる）。記号は source に持つ", () => {
    for (const chapter of GENERATED_CHAPTERS) {
      const chapterRow = curriculumOf(chapter.grade, chapter.subjectId)!.chapters.find((entry) => chapter.id.includes(`-${String(curriculumOf(chapter.grade, chapter.subjectId)!.chapters.indexOf(entry) + 1).padStart(2, "0")}`))!;
      for (const item of chapter.items) {
        const row = BY_CODE.get(item.codes[0]!)!;
        expect(plainText(item.title)).toBe(bodyOf(row.text));
        const parent = parentRow(row);
        const isNameOnly = !parent || parent.code === chapterRow.codes.find((code) => code === parent.code) || tidy(parent.text).startsWith("〔");
        expect(plainText(item.learn)).toBe(isNameOnly ? chapterRow.name : bodyOf(parent.text));
        expect(item.source.length).toBeGreaterThan(0);
        expect(item.title).not.toMatch(/^[(（][ｱ-ﾝア-ン0-9０-９]+[)）]/);
        expect(item.title).not.toMatch(/^[ア-ン]　/);
      }
    }
  });

  it("算数の記号は A(5)ア(ア) の形（(ｱ)は(ア)に直す）", () => {
    for (const grade of [1, 2, 3, 4, 6] as const) {
      for (const item of chaptersOf(grade, "sansu").flatMap((chapter) => chapter.items)) {
        expect(item.source).toMatch(/^[A-D]\(\d+\)[アイウ]\([ア-ン]\)$/);
      }
    }
  });
});

describe("読み（C-21）", () => {
  const textsOf = (chapter: Chapter): string[] => [
    chapter.tab,
    chapter.title,
    ...chapter.items.flatMap((item) => [item.title, item.learn]),
    ...chapter.sides.map((side) => side.title),
  ];

  it("漢字は [語|よみ] の中だけにあり、読みはひらがな。語に | と ] は入らない", () => {
    for (const chapter of ALL_CHAPTERS) {
      for (const text of textsOf(chapter)) {
        for (const segment of parseRuby(text)) {
          if (segment.type === "text") expect(segment.text, `${chapter.id}：${text}`).not.toMatch(/[一-鿿々〆]/);
          if (segment.type === "ruby") expect(segment.reading).toMatch(/^[ぁ-ゖー，・]+$/);
        }
        expect(text).not.toMatch(/[\n\r《》]/);
      }
    }
  });

  it("plainText に通すと、元の本文に戻る。学年の決まりで漢字かよみになる", () => {
    for (const chapter of GENERATED_CHAPTERS) {
      for (const item of chapter.items) {
        const original = plainText(item.title);
        expect(displayText(item.title, null)).toBe(original);
        // 1年では、習っていない漢字がよみになる
        expect(displayText(item.title, 1).length).toBeGreaterThan(0);
      }
    }
    // 1年は名前の表で置き換わるので、置き換え前の生成した章を見る（#416）
    const first = GENERATED_CHAPTERS.find((chapter) => chapter.grade === 1 && chapter.subjectId === "kokugo")!.items[0]!;
    expect(displayText(first.title, 6)).toContain("事物");
    expect(displayText(first.title, 1)).toContain("じぶつ");
  });
});

describe("5年の算数の13章と国語の漢字の章（C-22、C-23）", () => {
  itWithCodeTable("id・並び・マスの数・コードは手で持つ物のまま、章の名前だけ学習指導要領の言葉になる。マスの本文は guideline に残る", () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "integer", "decimal", "fraction", "expression", "plane", "solid", "area", "volume", "proportion", "unit", "ratio", "graph", "average",
    ]);
    expect(CHAPTERS.map((chapter) => chapter.items.length)).toEqual([5, 7, 9, 3, 4, 3, 4, 4, 4, 4, 3, 4, 2]);
    expect(chaptersOf(5, "sansu")).toEqual(CHAPTERS);
    for (const chapter of CHAPTERS) {
      expect([chapter.grade, chapter.subjectId, chapter.ordered]).toEqual([5, "sansu", false]);
      const entry = curriculumOf(5, "sansu")!.chapters.find((candidate) => candidate.chapterId === chapter.id)!;
      expect(plainText(chapter.tab)).toBe(entry.name);
      expect(plainText(chapter.title)).toBe(entry.name);
      for (const item of chapter.items) {
        const row = BY_CODE.get(item.codes[0]!)!;
        expect(plainText(item.guideline ?? "")).toBe(bodyOf(row.text));
        expect(item.source.length).toBeGreaterThan(0);
      }
      for (const side of chapter.sides) {
        if (side.codes?.length && side.guideline) expect(plainText(side.guideline)).toBe(bodyOf(BY_CODE.get(side.codes[0]!)!.text));
        expect(side.title).toMatch(/[|]|[ぁ-ん]/);
      }
    }
    const decimal = CHAPTERS.find((chapter) => chapter.id === "decimal")!;
    expect(plainText(decimal.tab)).toBe("小数");
    expect(plainText(decimal.items[0]!.guideline ?? "")).toBe("ある数の10倍，100倍，1000倍，1/10 ， 1/100などの大きさの数を，小数点の位置を移してつくること。");
    expect(decimal.items[0]!.title).toBe("10[倍|ばい]・100[倍|ばい]と<wbr>[小数点|しょうすうてん]");
  });

  it("5年算数のマスの名前は子ども向けの短い言葉で、学習指導要領の文（柱書き・本文）が子どもの名前と説明に入らない（#416、D-152）", () => {
    const items = CHAPTERS.flatMap((chapter) => chapter.items);
    expect(items.length).toBe(56);
    for (const item of items) {
      for (const text of [plainText(item.title), plainText(item.learn)]) {
        expect(text).not.toMatch(/身に付ける|次のような|こと。$|及び|理解すること/);
      }
      expect([...plainText(item.title).replace(/\s/g, "")].length).toBeLessThanOrEqual(12);
      expect(item.guideline).toBeTruthy();
    }
    for (const side of CHAPTERS.flatMap((chapter) => chapter.sides)) {
      expect(plainText(side.title)).not.toMatch(/身に付ける|次のような|こと。$|及び/);
    }
  });

  it("寄り道で source・codes が無い物は、今の名前のまま", () => {
    const training = CHAPTERS.flatMap((chapter) => chapter.sides).find((side) => side.id === "decimal-t");
    expect(training?.title).toBe("[小数|しょうすう]のかけ[算|ざん]のかくにん");
  });

  it("国語の漢字の章は、id とマス4つを変えず、名前は「5年の漢字」のまま（C-26）", () => {
    const kanji = KOKUGO_CHAPTERS[0]!;
    expect(kanji.id).toBe("kokugo-kanji-5");
    expect(kanji.items.map((item) => item.title)).toEqual([
      "[熟語|じゅくご]の[読|よ]み", "[送|おく]りがな", "[読|よ]みを[書|か]く", "[同|おな]じ[読|よ]みの[字|じ]",
    ]);
    expect(plainText(kanji.tab)).toBe("5年");
    expect(plainText(kanji.title)).toBe("5年の漢字");
    expect([kanji.grade, kanji.subjectId, kanji.ordered]).toEqual([5, "kokugo", false]);
  });
});

describe("子ども向けのマスの名前（kid-cell-names、C-35、#416）", () => {
  const SENTENCE = /身に付ける|次のような|こと。$|及び|理解すること/;
  const nameLength = (text: string): number => [...plainText(text).replace(/\s/g, "")].length;
  const generated6 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 6);
  const chapters6 = ALL_CHAPTERS.filter((chapter) => chapter.grade === 6);

  it("6年は62章・238マス。全部のマスに名前があり、本文は guideline に残る", () => {
    expect(chapters6.length).toBe(62);
    expect(generated6.length).toBe(62);
    const items = chapters6.flatMap((chapter) => chapter.items);
    expect(items.length).toBe(238);
    for (const chapter of chapters6) {
      const original = generated6.find((entry) => entry.id === chapter.id)!;
      expect(chapter.items.length, chapter.id).toBe(original.items.length);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        // 構造（source・codes・並び）は生成した物のまま。本文は guideline に移る
        expect([item.source, item.codes], `${chapter.id}#${index}`).toEqual([source.source, source.codes]);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title).not.toBe(source.title);
        expect(plainText(item.guideline ?? "").length).toBeGreaterThan(0);
      });
    }
  });

  it("6年のマスの名前は12字以内、名前と説明に学習指導要領の言い回しが入らない。同じ章の中で名前が重ならない", () => {
    for (const chapter of chapters6) {
      const titles = chapter.items.map((item) => plainText(item.title));
      expect(new Set(titles).size, `${chapter.id} の名前が重なる`).toBe(titles.length);
      for (const item of chapter.items) {
        expect(nameLength(item.title), `${chapter.id}：${plainText(item.title)}`).toBeLessThanOrEqual(12);
        expect(nameLength(item.title)).toBeGreaterThan(0);
        for (const text of [plainText(item.title), plainText(item.learn)]) expect(text, chapter.id).not.toMatch(SENTENCE);
        expect(plainText(item.learn).length).toBeGreaterThan(0);
      }
    }
  });

  itWithCodeTable("guideline は、コード表の本文（記号を外した物）と同じ", () => {
    for (const item of chapters6.flatMap((chapter) => chapter.items)) {
      expect(plainText(item.guideline ?? "")).toBe(bodyOf(BY_CODE.get(item.codes[0]!)!.text));
    }
  });

  it("名前を短くした章は 12字以内で、tab と title が同じ。ほかの章の名前は生成した物のまま", () => {
    const renamed = chapters6.filter((chapter) => chapter.title !== generated6.find((entry) => entry.id === chapter.id)!.title);
    expect(renamed.map((chapter) => chapter.id)).toEqual(["sansu-6-04", "shakai-6-03", "katei-6-01", "katei-6-04", "katei-6-11"]);
    for (const chapter of renamed) {
      expect(chapter.tab).toBe(chapter.title);
      expect(nameLength(chapter.title)).toBeLessThanOrEqual(12);
    }
    for (const chapter of chapters6.filter((entry) => !renamed.includes(entry))) {
      const original = generated6.find((entry) => entry.id === chapter.id)!;
      expect([chapter.tab, chapter.title]).toEqual([original.tab, original.title]);
    }
  });

  it("表のキー（章の id・マスの source）は、実在する物だけ。再生成で崩れたらここで落ちる", () => {
    for (const [chapterId, names] of Object.entries(KID_CELL_NAMES)) {
      const chapter = GENERATED_CHAPTERS.find((entry) => entry.id === chapterId);
      expect(chapter, `章 ${chapterId} が無い`).toBeDefined();
      for (const source of Object.keys(names.items)) {
        expect(chapter!.items.filter((item) => item.source === source).length, `${chapterId} の ${source}`).toBe(1);
      }
      for (const sideId of Object.keys(names.sides ?? {})) expect(chapter!.sides.some((side) => side.id === sideId), `${chapterId} の ${sideId}`).toBe(true);
    }
  });

  it("表のどの名前（今は6年だけ、後で1〜5年）も、12字以内で、指導要領の言い回しが入らない", () => {
    for (const [chapterId, names] of Object.entries(KID_CELL_NAMES)) {
      for (const kid of [...Object.values(names.items), ...Object.values(names.sides ?? {})]) {
        expect(nameLength(kid.title), `${chapterId}：${plainText(kid.title)}`).toBeLessThanOrEqual(12);
        for (const text of [plainText(kid.title), plainText(kid.learn)]) expect(text, chapterId).not.toMatch(SENTENCE);
      }
    }
  });

  it("applyKidNames：名前のあるマス・寄り道は title・learn を置き換えて元を guideline に残す。無い物と表の無い章は、そのまま", () => {
    const base: Chapter = {
      id: "x-1", grade: 1, subjectId: "sansu", ordered: false, tab: "元の章", title: "元の章", sources: [],
      items: [
        { title: "元の文1こと。", learn: "次のような知識。", source: "(1)ア", codes: ["1"] },
        { title: "元の文2こと。", learn: "次のような知識。", source: "(1)イ", codes: ["2"] },
      ],
      sides: [
        { id: "s1", type: "training", after: 0, title: "元の寄り道", learn: "元", tentative: false },
        { id: "s2", type: "advanced", after: 1, title: "そのまま", learn: "元", tentative: false },
      ],
    };
    const table = { "x-1": { items: { "(1)ア": { title: "名前1", learn: "説明1" } }, sides: { s1: { title: "寄り道の名前", learn: "寄り道の説明" } } } };
    const applied = applyKidNames(base, table);
    expect(applied.items[0]).toEqual({ ...base.items[0], title: "名前1", learn: "説明1", guideline: "元の文1こと。" });
    expect(applied.items[1]).toBe(base.items[1]);
    expect(applied.sides[0]).toEqual({ ...base.sides[0], title: "寄り道の名前", learn: "寄り道の説明", guideline: "元の寄り道" });
    expect(applied.sides[1]).toBe(base.sides[1]);
    expect([applied.tab, applied.title]).toEqual(["元の章", "元の章"]);
    expect(applyKidNames(base, {})).toBe(base);
    expect(applyKidNames({ ...base, id: "y" }, table).items[0]).toBe(base.items[0]);
  });

  it("1〜6年の表が全部そろったので、生成した章で名前の表に無いものは無い（表に無い章がそのまま出る動きは上の applyKidNames の試験で見る）", () => {
    const untouched = ALL_CHAPTERS.filter((chapter) => GENERATED_CHAPTERS.some((entry) => entry.id === chapter.id) && !(chapter.id in KID_CELL_NAMES));
    expect(untouched.map((chapter) => chapter.id)).toEqual([]);
  });
});

describe("2年のマスの名前（kid-cell-names、#416）", () => {
  const generated2 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 2);
  const chapters2 = ALL_CHAPTERS.filter((chapter) => chapter.grade === 2);

  it("2年は31章・132マス。全部のマスに名前があり、本文は guideline に残る。章の名前は生成した物のまま", () => {
    expect(generated2.length).toBe(31);
    expect(chapters2.length).toBe(31);
    expect(chapters2.flatMap((chapter) => chapter.items).length).toBe(132);
    for (const chapter of chapters2) {
      const original = generated2.find((entry) => entry.id === chapter.id)!;
      expect([chapter.tab, chapter.title], chapter.id).toEqual([original.tab, original.title]);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        expect(item.source, `${chapter.id}#${index}`).toBe(source.source);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title).not.toBe(source.title);
      });
    }
  });
});

describe("1年のマスの名前（kid-cell-names、#416）", () => {
  const generated1 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 1);
  const chapters1 = ALL_CHAPTERS.filter((chapter) => chapter.grade === 1);

  it("1年は30章・127マス。全部のマスに名前があり、本文は guideline に残る。章の名前は生成した物のまま", () => {
    expect(generated1.length).toBe(30);
    expect(chapters1.length).toBe(30);
    expect(chapters1.flatMap((chapter) => chapter.items).length).toBe(127);
    for (const chapter of chapters1) {
      const original = generated1.find((entry) => entry.id === chapter.id)!;
      expect([chapter.tab, chapter.title], chapter.id).toEqual([original.tab, original.title]);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        expect(item.source, `${chapter.id}#${index}`).toBe(source.source);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title).not.toBe(source.title);
      });
    }
  });
});

describe("4年のマスの名前（kid-cell-names、#416）", () => {
  const SENTENCE = /身に付ける|次のような|こと。$|及び|理解すること/;
  const nameLength = (text: string): number => [...plainText(text).replace(/\s/g, "")].length;
  const generated4 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 4);
  const chapters4 = ALL_CHAPTERS.filter((chapter) => chapter.grade === 4);

  it("4年は54章・204マス。全部のマスに名前があり、本文は guideline に残る", () => {
    expect(chapters4.length).toBe(54);
    expect(generated4.length).toBe(54);
    expect(chapters4.flatMap((chapter) => chapter.items).length).toBe(204);
    for (const chapter of chapters4) {
      const original = generated4.find((entry) => entry.id === chapter.id)!;
      expect(chapter.items.length, chapter.id).toBe(original.items.length);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        expect([item.source, item.codes], `${chapter.id}#${index}`).toEqual([source.source, source.codes]);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title).not.toBe(source.title);
      });
    }
  });

  it("4年のマスの名前は12字以内、名前と説明に学習指導要領の言い回しが入らない。同じ章の中で名前が重ならない。章の名前は変わらない", () => {
    for (const chapter of chapters4) {
      const original = generated4.find((entry) => entry.id === chapter.id)!;
      expect([chapter.tab, chapter.title]).toEqual([original.tab, original.title]);
      const titles = chapter.items.map((item) => plainText(item.title));
      expect(new Set(titles).size, `${chapter.id} の名前が重なる`).toBe(titles.length);
      for (const item of chapter.items) {
        expect(nameLength(item.title), `${chapter.id}：${plainText(item.title)}`).toBeLessThanOrEqual(12);
        expect(nameLength(item.title)).toBeGreaterThan(0);
        for (const text of [plainText(item.title), plainText(item.learn)]) expect(text, chapter.id).not.toMatch(SENTENCE);
        expect(plainText(item.learn).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("shownSubjectsOf（FR-011）", () => {
  it("6年は算数・理科、1年は算数だけ（理科は実施されない）", () => {
    expect(shownSubjectsOf(6)).toEqual(["sansu", "rika"]);
    expect(shownSubjectsOf(1)).toEqual(["sansu"]);
  });

  it("どの学年も、実施される教科のうち算数・理科だけで、subjectsOfGrade は全教科のまま", () => {
    for (const grade of GRADES) {
      expect(shownSubjectsOf(grade)).toEqual(subjectsOfGrade(grade).filter((id) => id === "sansu" || id === "rika"));
    }
    expect(subjectsOfGrade(6)).toContain("kokugo");
  });
});

describe("5年の子ども向けのマスの名前（kid-cell-names、C-35、#416）", () => {
  const SENTENCE = /身に付ける|次のような|こと。$|及び|理解すること/;
  const nameLength = (text: string): number => [...plainText(text).replace(/\s/g, "")].length;
  const generated5 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 5);
  const chapters5 = ALL_CHAPTERS.filter((chapter) => chapter.grade === 5 && generated5.some((entry) => entry.id === chapter.id));

  it("5年の生成した章は52章・211マス。全部のマスに名前があり、本文は guideline に残る。章の名前は生成した物のまま", () => {
    expect(generated5.length).toBe(52);
    expect(chapters5.length).toBe(52);
    expect(chapters5.flatMap((chapter) => chapter.items).length).toBe(211);
    for (const chapter of chapters5) {
      const original = generated5.find((entry) => entry.id === chapter.id)!;
      expect([chapter.tab, chapter.title], chapter.id).toEqual([original.tab, original.title]);
      expect(chapter.items.length, chapter.id).toBe(original.items.length);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        expect([item.source, item.codes], `${chapter.id}#${index}`).toEqual([source.source, source.codes]);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title, `${chapter.id}#${index}`).not.toBe(source.title);
      });
    }
  });

  it("5年のマスの名前は12字以内、名前と説明に学習指導要領の言い回しが入らない。同じ章の中で名前が重ならない", () => {
    for (const chapter of chapters5) {
      const titles = chapter.items.map((item) => plainText(item.title));
      expect(new Set(titles).size, `${chapter.id} の名前が重なる`).toBe(titles.length);
      for (const item of chapter.items) {
        expect(nameLength(item.title), `${chapter.id}：${plainText(item.title)}`).toBeLessThanOrEqual(12);
        expect(nameLength(item.title)).toBeGreaterThan(0);
        for (const text of [plainText(item.title), plainText(item.learn)]) expect(text, chapter.id).not.toMatch(SENTENCE);
        expect(plainText(item.learn).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("3年のマスの名前（kid-cell-names/grade3.ts、#416）", () => {
  const SENTENCE = /身に付ける|次のような|こと。$|及び|理解すること/;
  const nameLength = (text: string): number => [...plainText(text).replace(/\s/g, "")].length;
  const generated3 = GENERATED_CHAPTERS.filter((chapter) => chapter.grade === 3);

  it("生成した3年は48章・191マス。全部のマスに名前（12字以内）と説明があり、本文は guideline に残る。言い回しが入らず、同じ章の中で名前が重ならない", () => {
    expect(generated3.length).toBe(48);
    expect(generated3.flatMap((chapter) => chapter.items).length).toBe(191);
    for (const original of generated3) {
      const chapter = ALL_CHAPTERS.find((entry) => entry.id === original.id)!;
      expect([chapter.tab, chapter.title], chapter.id).toEqual([original.tab, original.title]);
      expect(chapter.items.length, chapter.id).toBe(original.items.length);
      const titles = chapter.items.map((item) => plainText(item.title));
      expect(new Set(titles).size, `${chapter.id} の名前が重なる`).toBe(titles.length);
      chapter.items.forEach((item, index) => {
        const source = original.items[index]!;
        expect([item.source, item.codes], `${chapter.id}#${index}`).toEqual([source.source, source.codes]);
        expect(item.guideline, `${chapter.id}#${index}`).toBe(source.title);
        expect(item.title).not.toBe(source.title);
        expect(nameLength(item.title), `${chapter.id}：${plainText(item.title)}`).toBeLessThanOrEqual(12);
        expect(nameLength(item.title)).toBeGreaterThan(0);
        expect(plainText(item.learn).length).toBeGreaterThan(0);
        for (const text of [plainText(item.title), plainText(item.learn)]) expect(text, chapter.id).not.toMatch(SENTENCE);
      });
    }
  });
});
