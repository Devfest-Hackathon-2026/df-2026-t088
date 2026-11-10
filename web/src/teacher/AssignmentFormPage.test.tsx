import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssignmentFormPage } from "./AssignmentFormPage";
import { ADMIN_COPY, ASSIGNMENT_FORM_COPY } from "./copy";

type Call = { method: string; path: string; body: unknown };
let calls: Call[] = [];
let routes: Record<string, () => Response>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = [];
  routes = {
    "GET /api/v1/teacher/timetable": () => json({ now: "x", days: [], subjects: ["kokugo", "sansu"] }),
    "GET /api/v1/teacher/link-options": () => json({ now: "x", chapters: [{ chapterId: "fraction", name: "分数" }] }),
  };
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input).split("?")[0] ?? "";
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[`${method} ${path}`];
    return route ? route() : json({ error: { code: "INTERNAL" } }, 500);
  });
});

afterEach(() => vi.unstubAllGlobals());

const fill = async () => {
  fireEvent.change(await screen.findByLabelText(ASSIGNMENT_FORM_COPY.colSubject), { target: { value: "sansu" } });
  fireEvent.change(screen.getByLabelText(ASSIGNMENT_FORM_COPY.colName), { target: { value: "分数" } });
  fireEvent.change(screen.getByLabelText(ASSIGNMENT_FORM_COPY.colDueDate), { target: { value: "2026-11-10" } });
  fireEvent.change(screen.getByLabelText(ASSIGNMENT_FORM_COPY.hour), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText(ASSIGNMENT_FORM_COPY.minute), { target: { value: "00" } });
};

describe("課題の入れ方（SCR-T07）", () => {
  it("空のまま保存を押すと、送らずに、押せない理由を欄の下に書く", async () => {
    const navigate = vi.fn();
    render(<AssignmentFormPage navigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: ASSIGNMENT_FORM_COPY.save }));
    expect(screen.getByText(ASSIGNMENT_FORM_COPY.needName)).toBeTruthy();
    expect(screen.getByText(ASSIGNMENT_FORM_COPY.needSubject)).toBeTruthy();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("入れると、サーバーに送って、課題の一覧に戻す（配りましたの結果つき）", async () => {
    routes["POST /api/v1/teacher/assignments"] = () => json({ assignment: { id: "a-9" } }, 201);
    const navigate = vi.fn();
    render(<AssignmentFormPage navigate={navigate} />);

    await fill();
    fireEvent.click(screen.getByRole("button", { name: ASSIGNMENT_FORM_COPY.save }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ subjectId: "sansu", title: "分数", dueAt: "2026-11-10T15:00+09:00", link: null });
    expect(navigate).toHaveBeenCalledWith(`?view=assignments&done=added&title=${encodeURIComponent("分数")}`);
  });

  it("章のテストとつなぐときは、サーバーの章の一覧から選び、その章 id を送る", async () => {
    routes["POST /api/v1/teacher/assignments"] = () => json({ assignment: { id: "a-9" } }, 201);
    const navigate = vi.fn();
    render(<AssignmentFormPage navigate={navigate} />);

    await fill();
    fireEvent.click(screen.getByRole("radio", { name: ASSIGNMENT_FORM_COPY.linkChapter }));
    fireEvent.change(screen.getByLabelText(ASSIGNMENT_FORM_COPY.colChapter), { target: { value: "fraction" } });
    fireEvent.click(screen.getByRole("button", { name: ASSIGNMENT_FORM_COPY.save }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ link: { kind: "chapterTest", chapterId: "fraction" } });
  });

  it("ログインが要ると言われたら、入力を残して案内を出す", async () => {
    routes["POST /api/v1/teacher/assignments"] = () => json({ error: { code: "LOGIN_REQUIRED" } }, 401);
    const navigate = vi.fn();
    render(<AssignmentFormPage navigate={navigate} />);

    await fill();
    fireEvent.click(screen.getByRole("button", { name: ASSIGNMENT_FORM_COPY.save }));

    expect(await screen.findByText(ADMIN_COPY.loginRequired)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText(ASSIGNMENT_FORM_COPY.colName) as HTMLInputElement).value).toBe("分数");
  });
});
