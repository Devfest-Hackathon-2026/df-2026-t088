import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressPanel, nameOf } from "./ProgressPanel";
import { CLASS_COPY, ROSTER_SAMPLE_NAMES, STUDENT_ACCOUNT_COPY } from "./copy";
import { ROSTER_KEY } from "./roster";
import { sampleChapters, sampleClassProgress } from "./progress-model";

// 読み込みは保存した進み（API）。試験では、同じ形のデータを同期で返す（見本と同じ値）
vi.mock("./use-class-progress", async () => {
  const model = await import("./progress-model");
  const today = "2026-11-09";
  const students = model.sampleClassProgress(today).students;
  return { useClassProgress: (_key: number, subjectId: "sansu" | "rika" = "sansu") => ({ status: "ready", progress: model.classProgressFrom(`${today}T09:00:00+09:00`, students, subjectId) }) };
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

const rows = () => screen.getAllByRole("row").slice(1);
const links = () => screen.getAllByRole("link");

describe("SCR-T10 子どもの進み", () => {
  it("注（CP-1103）と、30行を番号順に出す", () => {
    render(<ProgressPanel reloadKey={0} />);
    expect(screen.getByText(CLASS_COPY.progressNote)).toBeTruthy();
    expect(rows()).toHaveLength(30);
    const all = links();
    expect(all).toHaveLength(30);
    expect(all[0]?.getAttribute("href")).toBe("?view=child&number=A-01");
    expect(all[29]?.getAttribute("href")).toBe("?view=child&number=A-30");
    expect(screen.getAllByRole("columnheader")).toHaveLength(sampleChapters().length + 3);
  });

  it("行のリンクは CP-1107 で開け、セルの CP-1106 も読める", () => {
    render(<ProgressPanel reloadKey={0} />);
    const link = screen.getByRole("link", { name: CLASS_COPY.rowLabel("A-07", ROSTER_SAMPLE_NAMES[6] ?? "") });
    expect(link.getAttribute("href")).toBe("?view=child&number=A-07");
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getAllByRole("img", { name: /マスのうち\d+マスを終えました$/ }).length).toBe(sampleChapters().length);
  });

  it("章ごとに棒と CP-1106 の読み上げ、全部で章の数だけ並ぶ。表には数字（n/n）を出さない（D-182）", () => {
    render(<ProgressPanel reloadKey={0} />);
    const first = within(rows()[0] as HTMLElement).getAllByRole("img");
    expect(first).toHaveLength(sampleChapters().length);
    for (const cell of first) {
      expect(cell.getAttribute("aria-label")).toMatch(/マスのうち\d+マスを終えました$/);
      expect(within(cell).queryByText(/^\d+\/\d+$/)).toBeNull();
    }
  });

  it("一度も学んでいない子（A-05）は、最後に学んだ日が「まだ」で全部 0", () => {
    render(<ProgressPanel reloadKey={0} />);
    const row = rows()[4] as HTMLElement;
    expect(within(row).getByText(CLASS_COPY.notYet)).toBeTruthy();
    for (const cell of within(row).getAllByRole("img")) expect(cell.getAttribute("aria-label")).toMatch(/のうち0マスを終えました$/);
  });

  it("端末の名簿の名前が見本より優先、名簿に無い番号は「—」（読み上げは名前なし）", () => {
    localStorage.setItem(ROSTER_KEY, JSON.stringify({ version: 1, entries: [{ number: "A-01", name: "端末の名前" }] }));
    render(<ProgressPanel reloadKey={0} />);
    expect(screen.getByRole("link", { name: CLASS_COPY.rowLabel("A-01", "端末の名前") })).toBeTruthy();
    expect(screen.getByText("端末の名前")).toBeTruthy();
  });

  it("名簿にも見本にも無い番号は名前が無い（「—」と読み上げ「名前なし」に使う）", () => {
    // 見本のデータの30人は全員に見本の名前があるので、画面では名前の引き方で確かめる
    expect(nameOf("A-99", {}, {})).toBeUndefined();
    expect(nameOf("A-01", { "A-01": "端末" }, { "A-01": "見本" })).toBe("端末");
    expect(nameOf("A-01", {}, { "A-01": "見本" })).toBe("見本");
    expect(CLASS_COPY.noName).toBe("—");
    expect(CLASS_COPY.noNameLabel).toBe("名前なし");
  });

  it("理科なら、章の列は6年の理科の章。行の href に &subject=rika が付き、記録が無いので棒は全部空", () => {
    const rika = sampleChapters("rika");
    expect(rika).toHaveLength(9);
    render(<ProgressPanel reloadKey={0} subjectId="rika" />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(rika.length + 3);
    expect(links()[0]?.getAttribute("href")).toBe("?view=child&number=A-01&subject=rika");
    expect(within(rows()[0] as HTMLElement).getAllByRole("img", { name: /マスのうち0マスを終えました$/ })).toHaveLength(rika.length);
  });
});

describe("今日学んだ人の数（#377）", () => {
  it("表の上に「今日学んだ人 n / 30」を出す", () => {
    const today = "2026-11-09";
    const studied = sampleClassProgress(today).students.filter((student) => student.lastStudiedOn === today).length;
    render(<ProgressPanel reloadKey={0} />);
    expect(screen.getByText(CLASS_COPY.studiedToday(studied, 30))).toBeTruthy();
  });
});

describe("並べ替えと今日だけの絞り込み（#538）", () => {
  it("番号の見出しで降順に並べ、もう一度押すと昇順に戻る。今日だけに絞ると、今日学んだ子だけになる", () => {
    const today = "2026-11-09";
    const studiedIds = sampleClassProgress(today).students.filter((student) => student.lastStudiedOn === today).map((student) => student.number);
    render(<ProgressPanel reloadKey={0} />);
    const numberButton = screen.getByRole("button", { name: STUDENT_ACCOUNT_COPY.colNumber });
    fireEvent.click(numberButton);
    expect(screen.getByRole("columnheader", { name: new RegExp(STUDENT_ACCOUNT_COPY.colNumber) }).getAttribute("aria-sort")).toBe("descending");
    expect(links()[0]?.getAttribute("href")).toBe("?view=child&number=A-30");
    fireEvent.click(numberButton);
    expect(links()[0]?.getAttribute("href")).toBe("?view=child&number=A-01");
    fireEvent.click(screen.getByRole("checkbox", { name: CLASS_COPY.todayOnly }));
    expect(rows()).toHaveLength(studiedIds.length);
    expect(links().map((link) => link.textContent)).toEqual(studiedIds);
  });
});
