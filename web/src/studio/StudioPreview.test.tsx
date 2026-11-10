import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_FIXTURES } from "./api";
import { toLesson } from "./to-lesson";
import { StudioPreview } from "./StudioPreview";

const sideEffects = vi.hoisted(() => ({ saveResume: vi.fn(), reportIfRecordable: vi.fn(), loadApprovedHints: vi.fn() }));
vi.mock("../game/lesson-resume", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../game/lesson-resume")>()),
  saveResume: sideEffects.saveResume,
}));
vi.mock("../lesson/stumble-reporter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lesson/stumble-reporter")>()),
  reportIfRecordable: sideEffects.reportIfRecordable,
}));
vi.mock("../lesson/approved-hints", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lesson/approved-hints")>()),
  loadApprovedHints: sideEffects.loadApprovedHints,
}));

const button = (scope: ReturnType<typeof within>, name: string | RegExp) => scope.getByRole("button", { name });

function place(scope: ReturnType<typeof within>, name: string) {
  fireEvent.click(scope.getByRole("button", { name: new RegExp(`^[0-9]+/[0-9]+、${name}のタイル。のこり`) }));
  fireEvent.click(button(scope, "ものさしに置く"));
}

beforeEach(() => {
  sideEffects.saveResume.mockClear();
  sideEffects.reportIfRecordable.mockClear();
  sideEffects.loadApprovedHints.mockClear();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("StudioPreview", () => {
  it("見本教材を左右に表示し、タイルで解いて答えられる", () => {
    const lesson = toLesson({ ...STUDIO_FIXTURES.valid, problems: [...STUDIO_FIXTURES.valid.problems, ...STUDIO_FIXTURES.valid.problems] });
    render(<StudioPreview lessons={[{ label: "Before", lesson }, { label: "After", lesson }]} />);

    expect(screen.getAllByText("見本データのプレビュー")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Before" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "After" })).toBeTruthy();
    const first = within(screen.getByRole("region", { name: "Before" }));
    fireEvent.click(first.getByRole("button", { name: "分かんない" }));
    place(first, "2分の1");
    place(first, "3分の1");
    fireEvent.click(first.getByRole("button", { name: /^1\/6、6分の1のタイル。のこり/ }));
    for (let index = 0; index < 5; index += 1) fireEvent.click(first.getByRole("button", { name: "タイルに重ねる" }));
    fireEvent.click(first.getByRole("button", { name: "もとの問題にもどる" }));
    const slots = first.getAllByLabelText(/分のいくつ$/);
    fireEvent.change(slots[0]!, { target: { value: "3" } });
    fireEvent.change(slots[1]!, { target: { value: "2" } });
    fireEvent.click(first.getByRole("button", { name: "こたえる" }));
    fireEvent.change(first.getByLabelText(/^こたえ/), { target: { value: "1/2" } });
    fireEvent.click(first.getByRole("button", { name: "こたえる" }));
    expect(first.getByText(/ちがうみたいです/)).toBeTruthy();
    fireEvent.change(first.getByLabelText(/^こたえ/), { target: { value: "5/6" } });
    fireEvent.click(first.getByRole("button", { name: "こたえる" }));

    expect(first.getByText("せいかいです")).toBeTruthy();
    expect(localStorage.length).toBe(0);
    expect(sideEffects.saveResume).not.toHaveBeenCalled();
    expect(sideEffects.reportIfRecordable).not.toHaveBeenCalled();
    expect(sideEffects.loadApprovedHints).not.toHaveBeenCalled();
    fireEvent.click(first.getByRole("button", { name: "つぎの問題へ" }));
    expect(first.getByText("2 / 2 問")).toBeTruthy();
    expect(sideEffects.saveResume).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it("3案の比較にも使える", () => {
    const lesson = toLesson(STUDIO_FIXTURES.valid);
    render(<StudioPreview lessons={["案1", "案2", "案3"].map((label) => ({ label, lesson }))} />);
    expect(["案1", "案2", "案3"].map((label) => screen.getByRole("region", { name: label })).length).toBe(3);
  });
});
