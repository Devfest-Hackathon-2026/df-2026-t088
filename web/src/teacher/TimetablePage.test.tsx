import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimetablePage } from "./TimetablePage";
import { TIMETABLE_COPY } from "./copy";

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let routes: Record<string, () => Response>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const days = [
  { weekday: 1, periods: [{ period: 1, subjectId: "kokugo" }, { period: 2, subjectId: "sansu" }] },
  { weekday: 2, periods: [{ period: 1, subjectId: "rika" }] },
];

beforeEach(() => {
  calls = [];
  routes = { "GET /api/v1/teacher/timetable": () => json({ now: "x", days, subjects: ["kokugo", "sansu", "rika"] }) };
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input).split("?")[0] ?? "";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${path}`];
    return route ? route() : json({ error: { code: "INTERNAL" } }, 500);
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("時間割（SCR-T08）", () => {
  it("表の行はコマ、列は曜日で、コマの無いところは「—」", async () => {
    render(<TimetablePage />);

    const second = await screen.findByRole("row", { name: new RegExp(TIMETABLE_COPY.periodLabel(2)) });
    expect(within(second).getByText(TIMETABLE_COPY.empty)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "月" })).toBeTruthy();
  });

  it("承認キーがない読み出しはキーの案内を表示する", async () => {
    routes["GET /api/v1/teacher/timetable"] = () => json({ error: { code: "UNAUTHORIZED" } }, 401);
    render(<TimetablePage />);

    expect(await screen.findByText("承認キーを入れてください")).toBeTruthy();
  });

  it("曜日は 7 つまで。上限に当たると、表は変えずに理由を操作の下に書く", async () => {
    render(<TimetablePage />);

    const add = await screen.findByRole("button", { name: TIMETABLE_COPY.addDay });
    for (let index = 0; index < 5; index += 1) fireEvent.click(add);
    expect(screen.getAllByRole("columnheader").length).toBe(8); // 空の角 + 7 曜日
    fireEvent.click(add);
    expect(screen.getByText(TIMETABLE_COPY.maxDays)).toBeTruthy();
    expect(screen.getAllByRole("columnheader").length).toBe(8);
  });

  it("保存は、表の全部をまとめて送り、結果を出す", async () => {
    routes["PUT /api/v1/teacher/timetable"] = () => json({ now: "x", days });
    render(<TimetablePage />);

    fireEvent.change(await screen.findByRole("combobox", { name: `月 ${TIMETABLE_COPY.periodLabel(1)}` }), { target: { value: "rika" } });
    fireEvent.click(screen.getByRole("button", { name: TIMETABLE_COPY.save }));

    expect(await screen.findByText(TIMETABLE_COPY.saved)).toBeTruthy();
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.body).toEqual({
      days: [
        { weekday: 1, periods: [{ period: 1, subjectId: "rika" }, { period: 2, subjectId: "sansu" }] },
        { weekday: 2, periods: [{ period: 1, subjectId: "rika" }] },
      ],
    });
  });

  it("保存に失敗しても、表は残して、表は残っていることを書く", async () => {
    routes["PUT /api/v1/teacher/timetable"] = () => json({ error: { code: "INTERNAL" } }, 500);
    render(<TimetablePage />);

    fireEvent.click(await screen.findByRole("button", { name: TIMETABLE_COPY.save }));
    expect(await screen.findByText(TIMETABLE_COPY.saveFailed)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: `月 ${TIMETABLE_COPY.periodLabel(1)}` })).toBeTruthy();
  });
});
