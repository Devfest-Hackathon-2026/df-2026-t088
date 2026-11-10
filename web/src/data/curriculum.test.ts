import { describe, expect, it } from "vitest";
import { CHAPTERS } from "./chapters";
import { SUBJECTS } from "./constants";
import { CURRICULUM } from "./curriculum";

const subjectsOf = (grade: number) => CURRICULUM.find((entry) => entry.grade === grade)?.subjects ?? [];
const idsOf = (grade: number) => subjectsOf(grade).map((subject) => subject.subjectId);
const grade5Math = subjectsOf(5).find((subject) => subject.subjectId === "sansu")?.chapters ?? [];

describe("学年ごとの章の基準", () => {
  it("1年から6年まで、学年にある教科だけを教科の順に持つ", () => {
    expect(CURRICULUM.map((entry) => entry.grade)).toEqual([1, 2, 3, 4, 5, 6]);
    const order = SUBJECTS.map((subject) => subject.id);
    for (const { subjects } of CURRICULUM) {
      const ids = subjects.map((subject) => subject.subjectId);
      expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    }
    // 生活は 1・2年だけ（FR-001）。5年以上は生活を除く全部
    expect(idsOf(1)).toEqual(["kokugo", "sansu", "ongaku", "taiiku", "zuko", "seikatsu"]);
    expect(idsOf(3)).toEqual(["kokugo", "sansu", "rika", "shakai", "eigo", "ongaku", "taiiku", "zuko"]);
    expect(idsOf(5)).toEqual(order.filter((id) => id !== "seikatsu"));
  });

  it("算数の章の数は文書の表と同じ", () => {
    const counts = CURRICULUM.map(({ grade }) => subjectsOf(grade).find((subject) => subject.subjectId === "sansu")?.chapters.length);
    expect(counts).toEqual([6, 7, 12, 16, 13, 10]);
  });

  it("章は記号と学習指導要領コードを持ち、教科の中でコードが重ならない", () => {
    for (const { subjects } of CURRICULUM) {
      for (const { chapters } of subjects) {
        const codes = chapters.flatMap((chapter) => chapter.codes);
        expect(new Set(codes).size).toBe(codes.length);
        for (const chapter of chapters) {
          expect(chapter.sources.length).toBeGreaterThan(0);
          expect(chapter.codes.length).toBeGreaterThan(0);
          for (const code of chapter.codes) expect(code).toMatch(/^82[0-9A-Z]{14}$/);
        }
      }
    }
  });

  it("2学年まとめの教科は、どちらの学年でも同じ years を持つ", () => {
    for (const { grade, subjects } of CURRICULUM) {
      for (const subject of subjects) {
        expect(subject.years).toContain(grade);
        for (const year of subject.years) expect(idsOf(year)).toContain(subject.subjectId);
      }
    }
  });

  it("5年の算数は、作品の13章と1つずつ対応する", () => {
    expect(grade5Math.map((chapter) => chapter.chapterId).sort()).toEqual(CHAPTERS.map((chapter) => chapter.id).sort());
    for (const { chapterId, sources } of grade5Math) {
      expect(sources).toEqual(CHAPTERS.find((chapter) => chapter.id === chapterId)?.sources);
    }
  });

  it("5年の算数の並びは、分野の中で作品の章の順番と同じ", () => {
    const fromCurriculum = grade5Math.map((chapter) => chapter.chapterId);
    for (const domain of ["number", "shape", "change", "data"]) {
      const ids = CHAPTERS.filter((chapter) => chapter.domain === domain).map((chapter) => chapter.id);
      expect(fromCurriculum.filter((id) => ids.includes(id ?? ""))).toEqual(ids);
    }
  });
});
