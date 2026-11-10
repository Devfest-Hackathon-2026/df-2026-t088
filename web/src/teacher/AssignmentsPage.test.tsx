import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentsPage } from "./AssignmentsPage";
import { ADMIN_COPY, ASSIGNMENTS_COPY } from "./copy";

type Call = { method: string; path: string };
let calls: Call[] = [];
let routes: Record<string, () => Response>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input).split("?")[0] ?? "";
    calls.push({ method, path });
    const route = routes[`${method} ${path}`];
    return route ? route() : json({ error: { code: "INTERNAL" } }, 500);
  });
});

afterEach(() => vi.unstubAllGlobals());

const assignment = { id: "a-1", subjectId: "sansu", title: "[分数|ぶんすう]のテスト", dueAt: "2026-11-10T15:00:00+09:00", link: null };

describe("課題の一覧（SCR-T06）", () => {
  it("行に、出した数（n/30）と、直す・消すの操作を出す", async () => {
    routes["GET /api/v1/teacher/assignments"] = () => json({ now: "2026-11-09T10:00:00+09:00", assignments: [assignment] });
    routes["GET /api/v1/teacher/submissions"] = () => json({ now: "x", classSize: 30, assignments: [{ id: "a-1", submittedCount: 12 }] });
    render(<AssignmentsPage />);

    const count = await screen.findByText("12/30");
    const row = count.closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: ASSIGNMENTS_COPY.edit }).getAttribute("href")).toBe("?view=assignment&id=a-1");
    expect(within(row).getByRole("button", { name: ASSIGNMENTS_COPY.remove })).toBeTruthy();
  });

  it("消すは確認パネルを出し、出した人数を書いてから消す。消したあとは件数を結果で出す", async () => {
    routes["GET /api/v1/teacher/assignments"] = () => json({ now: "x", assignments: [assignment] });
    routes["GET /api/v1/teacher/submissions"] = () => json({ now: "x", classSize: 30, assignments: [{ id: "a-1", submittedCount: 12 }] });
    routes["DELETE /api/v1/teacher/assignments/a-1"] = () => json({ id: "a-1", removedSubmissions: 12 });
    render(<AssignmentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: ASSIGNMENTS_COPY.remove }));
    const panel = screen.getByRole("group", { name: ASSIGNMENTS_COPY.remove });
    expect(within(panel).getByText(ASSIGNMENTS_COPY.confirmRemove("分数のテスト", 12))).toBeTruthy();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    routes["GET /api/v1/teacher/assignments"] = () => json({ now: "x", assignments: [] });
    fireEvent.click(within(panel).getByRole("button", { name: ASSIGNMENTS_COPY.confirmYes }));
    expect(await screen.findByText(ASSIGNMENTS_COPY.removed("分数のテスト", 12))).toBeTruthy();
    expect(calls.some((call) => call.method === "DELETE" && call.path === "/api/v1/teacher/assignments/a-1")).toBe(true);
  });

  it("ログインが要るときは、一覧の代わりに案内を出す", async () => {
    routes["GET /api/v1/teacher/assignments"] = () => json({ error: { code: "UNAUTHORIZED" } }, 401);
    routes["GET /api/v1/teacher/submissions"] = () => json({ error: { code: "UNAUTHORIZED" } }, 401);
    render(<AssignmentsPage />);

    expect(await screen.findByText(ADMIN_COPY.notAuthorized)).toBeTruthy();
  });

  it("配った後に戻ってきたときは、結果を出す", async () => {
    routes["GET /api/v1/teacher/assignments"] = () => json({ now: "x", assignments: [assignment] });
    routes["GET /api/v1/teacher/submissions"] = () => json({ now: "x", classSize: 30, assignments: [] });
    render(<AssignmentsPage done={{ kind: "added", title: "分数" }} />);

    expect(await screen.findByText(ASSIGNMENTS_COPY.added("分数"))).toBeTruthy();
  });
});
