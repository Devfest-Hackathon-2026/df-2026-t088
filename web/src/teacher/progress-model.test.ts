import { describe, expect, it } from "vitest";
import { childProgressOf, classProgressFrom, classSubjects, formatStudiedOn, parseSubject, sampleChapters, sampleClassProgress, subjectName } from "./progress-model";

describe("見本の学級の進み", () => {
  it("同じ日なら、開くたびに同じ値", () => {
    expect(sampleClassProgress("2026-11-10")).toEqual(sampleClassProgress("2026-11-10"));
  });

  it("終えたマスは、章のマスの数を超えない", () => {
    const progress = sampleClassProgress("2026-11-10");
    const totals = new Map(progress.chapters.map((chapter) => [chapter.chapterId, chapter.total]));
    for (const student of progress.students) {
      for (const [chapterId, done] of Object.entries(student.done)) expect(done).toBeLessThanOrEqual(totals.get(chapterId) ?? 0);
    }
  });

  it("30人で、一度も学んでいない子（A-05）は記録が無い", () => {
    const progress = sampleClassProgress("2026-11-10");
    expect(progress.students).toHaveLength(30);
    expect(childProgressOf(progress, "A-05")?.lastStudiedOn).toBeNull();
    expect(childProgressOf(progress, "Z-99")).toBeUndefined();
  });

  it("日付は「11/6（金）」の形、null は「まだ」", () => {
    expect(formatStudiedOn("2026-11-06")).toBe("11/6（金）");
    expect(formatStudiedOn(null)).toBe("まだ");
  });
});

describe("教科", () => {
  it("6年は算数・理科。名前はふりがなを外した文字。不正な値は算数", () => {
    expect(classSubjects()).toEqual(["sansu", "rika"]);
    expect(classSubjects().map(subjectName)).toEqual(["算数", "理科"]);
    expect(parseSubject("rika")).toBe("rika");
    expect(parseSubject("kokugo")).toBe("sansu");
    expect(parseSubject(null)).toBe("sansu");
  });

  it("理科は理科の章だけの表で、算数の記録は拾わない", () => {
    const sansu = sampleClassProgress("2026-11-10");
    const rika = classProgressFrom(sansu.now, sansu.students, "rika");
    expect(rika.subjectId).toBe("rika");
    expect(rika.chapters.map((chapter) => chapter.chapterId)).toEqual(sampleChapters("rika").map((chapter) => chapter.id));
    expect(childProgressOf(rika, "A-01")?.chapters.every((chapter) => chapter.doneSquares.length === 0)).toBe(true);
  });
});
