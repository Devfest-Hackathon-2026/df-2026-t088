import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChildPage } from "./ChildPage";
import { CLASS_COPY, PROBLEM_COPY } from "./copy";
import { childProgressOf, sampleChapters, sampleClassProgress, todayInJapan } from "./progress-model";
import { plainText } from "../ruby-text";

// 読み込みは保存した進み（API）。試験では、同じ形のデータを同期で返す（見本と同じ値）
vi.mock("./use-class-progress", async () => {
  const model = await import("./progress-model");
  const today = model.todayInJapan();
  const students = model.sampleClassProgress(today).students;
  return { useClassProgress: (_key: number, subjectId: "sansu" | "rika" = "sansu") => ({ status: "ready", progress: model.classProgressFrom(`${today}T09:00:00+09:00`, students, subjectId) }) };
});

beforeEach(() => localStorage.clear());

const chapters = sampleChapters();
const progress = () => childProgressOf(sampleClassProgress(todayInJapan()), "A-07")!;
const cards = () => screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));

describe("SCR-T04 子どもの進み", () => {
  it("最初は「つぎ」のある最初の章の札が選ばれ、右の列はその章", () => {
    render(<ChildPage number="A-07" />);
    const first = progress().chapters.findIndex((chapter) => chapter.doneSquares.length < chapter.total);
    expect(cards()).toHaveLength(chapters.length);
    expect(cards()[first]?.getAttribute("aria-pressed")).toBe("true");
    expect(cards().filter((card) => card.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(plainText(chapters[first]?.title ?? ""));
    expect(screen.getByRole("link", { name: PROBLEM_COPY.back }).getAttribute("href")).toBe("?tab=progress");
  });

  it("札を押すと、右の列がその章に替わる", () => {
    render(<ChildPage number="A-07" />);
    const last = cards().length - 1;
    fireEvent.click(cards()[last] as HTMLElement);
    expect(cards()[last]?.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(plainText(chapters[last]?.title ?? ""));
  });

  it("終えたマスに「終えた」、次のマスに「つぎ」", () => {
    render(<ChildPage number="A-07" />);
    const first = progress().chapters.findIndex((chapter) => chapter.doneSquares.length < chapter.total);
    const done = progress().chapters[first]?.doneSquares.length ?? 0;
    const items = within(screen.getByRole("heading", { level: 2 }).parentElement as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(chapters[first]?.items.length ?? -1);
    if (done > 0) expect(items[0]?.textContent).toContain(CLASS_COPY.doneMark);
    expect(items[done]?.textContent).toContain(CLASS_COPY.next);
  });

  it("全部終えた札は CP-1113、そうでない札は CP-1114", () => {
    render(<ChildPage number="A-07" />);
    const states = progress().chapters.map((chapter) => chapter.doneSquares.length >= chapter.total);
    expect(states.some(Boolean)).toBe(true);
    states.forEach((all, index) => {
      const text = cards()[index]?.textContent ?? "";
      if (all) expect(text).toContain(CLASS_COPY.allDone);
      else expect(text).toContain("つぎ：");
    });
  });

  it("記録の無い子は札が全部 0 のまま、CP-1110 を出す", () => {
    render(<ChildPage number="A-05" />);
    expect(screen.getByText(CLASS_COPY.noRecord)).toBeTruthy();
    expect(cards()[0]?.getAttribute("aria-pressed")).toBe("true");
    for (const card of cards()) expect(within(card).getByText(/^0\//)).toBeTruthy();
  });

  it("学級にいない番号は CP-1111 と戻るだけ", () => {
    render(<ChildPage number="Z-99" />);
    expect(screen.getByText(CLASS_COPY.notInClass)).toBeTruthy();
    expect(screen.getByRole("link", { name: PROBLEM_COPY.back })).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("理科で開くと、理科の章の札を出し、戻るリンクは ?tab=progress&subject=rika", () => {
    render(<ChildPage number="A-07" subjectId="rika" />);
    const rika = sampleChapters("rika");
    expect(cards()).toHaveLength(rika.length);
    expect(cards()[0]?.textContent).toContain(plainText(rika[0]?.tab ?? ""));
    expect(screen.getByRole("link", { name: PROBLEM_COPY.back }).getAttribute("href")).toBe("?tab=progress&subject=rika");
  });
});
