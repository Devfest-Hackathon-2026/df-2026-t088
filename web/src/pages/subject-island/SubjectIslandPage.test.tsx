import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playSe } from "../../audio/use-bgm";
import { Toast } from "../../components/Toast";
import { COPY } from "../../copy";
import { chaptersOf, subjectsOfGrade } from "../../data";
import type { SubjectId } from "../../data";
import { GRADES } from "../../data/kanji-grades";
import type { Grade } from "../../data/kanji-grades";
import { useCourseGame } from "../../game/course";
import type { Course } from "../../game/course";
import { useGame } from "../../game/use-game";
import { ACCOUNT_KEY } from "../../account";
import { GradeProvider } from "../../grade";
import { findLesson } from "../../lesson/fraction-lessons";
import { KOKUGO_COURSE } from "../../lesson/kokugo-lessons";
import { displayText, plainText } from "../../ruby-text";
import { SubjectIslandPage } from "./SubjectIslandPage";

// 鳴らした効果音の種類だけを記録する（鍵の札は「選ぶ」音を鳴らす、D-133）
vi.mock("../../audio/use-bgm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../audio/use-bgm")>()),
  playSe: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(playSe).mockClear();
});

// App と同じ作り方で課程を作る（算数は findLesson、国語は漢字の章だけ、ほかは問題が無い）
function courseFor(subjectId: SubjectId, grade: Grade): Course {
  const hasLesson: Course["hasLesson"] = subjectId === "sansu"
    ? (chapterId, target) => findLesson(chapterId, target) !== undefined
    : (chapterId, target) => chapterId === "kokugo-kanji-5" && KOKUGO_COURSE.hasLesson(chapterId, target);
  return { subjectId, chapters: chaptersOf(grade, subjectId), hasLesson };
}

// 今の学年と教科から課程を作り、トーストも描く
function Harness({ subjectId, grade, onOpenMap, onOpenChapter }: { subjectId: SubjectId; grade: Grade; onOpenMap: () => void; onOpenChapter: (id: string) => void }) {
  const game = useGame();
  const course = courseFor(subjectId, grade);
  const courseGame = useCourseGame(game, course, "");
  return (
    <>
      <SubjectIslandPage subjectId={subjectId} course={course} game={courseGame} onOpenMap={onOpenMap} onOpenChapter={(chapter) => onOpenChapter(chapter.id)} />
      <Toast toast={game.toast} />
    </>
  );
}

function renderIsland(subjectId: SubjectId, grade: Grade, onOpenMap = () => {}, onOpenChapter = (_id: string) => {}) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade }));
  return render(<GradeProvider><Harness subjectId={subjectId} grade={grade} onOpenMap={onOpenMap} onOpenChapter={onOpenChapter} /></GradeProvider>);
}

const chapterCards = () => screen.getAllByRole("button").filter((button) => button.classList.contains("subject-island__chapter"));

describe("PG-005 教科の島", () => {
  it("国語は章札を出し、札を選ぶとその章を開く", () => {
    const onOpenMap = vi.fn();
    const onOpenChapter = vi.fn();
    renderIsland("kokugo", 5, onOpenMap, onOpenChapter);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(plainText(COPY.CP_501("国語")));
    expect(screen.getByRole("heading", { name: plainText(COPY.CP_503) })).toBeTruthy();
    const kanji = chaptersOf(5, "kokugo").find((chapter) => chapter.id === "kokugo-kanji-5")!;
    fireEvent.click(screen.getByRole("button", { name: displayText(kanji.title, 5) }));
    expect(onOpenChapter).toHaveBeenCalledWith("kokugo-kanji-5");
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_215) }));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it("どの教科にも章札が並び、章の名前は学習指導要領の言葉（D-116）。問題が無い章は鍵で、押しても開かない（D-133）", () => {
    const onOpenChapter = vi.fn();
    renderIsland("rika", 3, () => {}, onOpenChapter);
    const chapters = chaptersOf(3, "rika");
    expect(chapters.length).toBeGreaterThan(0);
    const cards = chapterCards();
    expect(cards).toHaveLength(chapters.length);
    // 理科3年は問題が無いので全部鍵。鍵は disabled ではなく aria-disabled（押せる）
    expect(cards.every((card) => card.getAttribute("aria-disabled") === "true" && !(card as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_207(chapters[0]!.title), 3) }));
    expect(onOpenChapter).not.toHaveBeenCalled();
    expect(screen.queryByText(plainText(COPY.CP_502))).toBeNull();
  });

  it("鍵の札を押すと、選ぶ音と CP-550（章名入り）のトーストが出て、章は開かない。開いた札は押すと章を開く（D-133）", () => {
    const onOpenChapter = vi.fn();
    renderIsland("sansu", 5, () => {}, onOpenChapter);
    const plane = chaptersOf(5, "sansu").find((chapter) => chapter.id === "plane")!;
    fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_207(plane.title), 5) }));
    expect(onOpenChapter).not.toHaveBeenCalled();
    expect(vi.mocked(playSe).mock.calls).toEqual([["select"]]);
    expect(screen.getByRole("status").textContent).toBe(displayText(COPY.CP_550(plane.title), 5));
    const fraction = chaptersOf(5, "sansu").find((chapter) => chapter.id === "fraction")!;
    fireEvent.click(screen.getByRole("button", { name: displayText(fraction.title, 5) }));
    expect(onOpenChapter).toHaveBeenCalledTimes(1);
    expect(onOpenChapter).toHaveBeenCalledWith("fraction");
  });

  it("5年の算数は 整数・小数・分数・式 の4章が開き、ほかの9章が鍵（D-133）", () => {
    renderIsland("sansu", 5);
    const chapters = chaptersOf(5, "sansu");
    const open = ["integer", "decimal", "fraction", "expression"];
    for (const chapter of chapters) {
      const isOpen = open.includes(chapter.id);
      const card = screen.getByRole("button", { name: displayText(isOpen ? chapter.title : COPY.CP_207(chapter.title), 5) });
      expect(card.getAttribute("aria-disabled")).toBe(isOpen ? null : "true");
    }
    expect(chapters.filter((chapter) => !open.includes(chapter.id))).toHaveLength(9);
  });

  it("1〜6年のどの教科でも、鍵の札の数は問題の無い章の数と同じで、鍵でない札は aria-disabled が無い（D-133）", () => {
    for (const grade of GRADES) {
      for (const subjectId of subjectsOfGrade(grade)) {
        const course = courseFor(subjectId, grade);
        if (course.chapters.length === 0) continue;
        const withoutLessons = course.chapters.filter((chapter) => ![{ kind: "test" as const }, ...chapter.items.map((_item, index) => ({ kind: "main" as const, index })), ...chapter.sides.map((side) => ({ kind: "side" as const, sideId: side.id }))].some((target) => course.hasLesson(chapter.id, target)));
        const { unmount } = renderIsland(subjectId, grade);
        const cards = chapterCards();
        const where = `${grade}年 ${subjectId}`;
        expect(cards, where).toHaveLength(course.chapters.length);
        const locked = cards.filter((card) => card.getAttribute("aria-disabled") === "true");
        expect(locked, where).toHaveLength(withoutLessons.length);
        for (const card of cards) {
          expect((card as HTMLButtonElement).disabled, where).toBe(false);
          const isLocked = card.getAttribute("aria-disabled") === "true";
          expect(card.classList.contains("is-locked"), where).toBe(isLocked);
          if (!isLocked) expect(card.hasAttribute("aria-disabled"), where).toBe(false);
        }
        for (const chapter of withoutLessons) {
          expect(within(document.body).getByRole("button", { name: displayText(COPY.CP_207(chapter.title), grade) }).getAttribute("aria-disabled"), where).toBe("true");
        }
        unmount();
      }
    }
  });

  it("生活の島は1年の章（内容のまとまり）を出す", () => {
    renderIsland("seikatsu", 1);
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("subject-island__chapter"))).toHaveLength(chaptersOf(1, "seikatsu").length);
  });
});
