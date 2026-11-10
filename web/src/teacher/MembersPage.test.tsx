import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MembersPage } from "./MembersPage";
import { MEMBERS_COPY } from "./copy";

type Call = { method: string; path: string; body?: unknown };
let calls: Call[] = [];
let routes: Record<string, (body?: unknown) => Response>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const LIST = { members: [{ email: "boss@school.example", role: "admin" }, { email: "two@school.example", role: "teacher" }], self: "boss@school.example" };

beforeEach(() => {
  calls = [];
  routes = {};
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(input).split("?")[0] ?? "";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const route = routes[`${method} ${path}`];
    return route ? route(body) : json({ error: { code: "INTERNAL" } }, 500);
  });
});

afterEach(() => vi.unstubAllGlobals());

const asAdmin = () => {
  routes["GET /api/v1/teacher/me"] = () => json({ enabled: true, signedIn: true, role: "admin" });
  routes["GET /api/v1/teacher/members"] = () => json(LIST);
};

describe("先生の管理（SCR-T12）", () => {
  it("ログインが off のときは、一覧を読まず「Google ログインが有効なときに使えます」を出す", async () => {
    routes["GET /api/v1/teacher/me"] = () => json({ enabled: false, signedIn: false });
    render(<MembersPage />);
    expect(await screen.findByText(MEMBERS_COPY.off)).toBeTruthy();
    expect(calls.some((call) => call.path === "/api/v1/teacher/members")).toBe(false);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("管理者でない先生には、一覧を読まず「管理者だけが使えます」を出す", async () => {
    routes["GET /api/v1/teacher/me"] = () => json({ enabled: true, signedIn: true, role: "teacher" });
    render(<MembersPage />);
    expect(await screen.findByText(MEMBERS_COPY.notAdmin)).toBeTruthy();
    expect(calls.some((call) => call.path === "/api/v1/teacher/members")).toBe(false);
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("管理者には一覧を出す。自分の行には「あなた」を出し、役割の変更と外すは出さない", async () => {
    asAdmin();
    render(<MembersPage />);
    const mine = (await screen.findByText("boss@school.example")).closest("tr") as HTMLElement;
    expect(within(mine).getByText(new RegExp(MEMBERS_COPY.self))).toBeTruthy();
    expect(within(mine).queryByRole("button")).toBeNull();
    const other = screen.getByText("two@school.example").closest("tr") as HTMLElement;
    expect(within(other).getByRole("button", { name: MEMBERS_COPY.makeAdmin })).toBeTruthy();
    expect(within(other).getByRole("button", { name: MEMBERS_COPY.remove })).toBeTruthy();
  });

  it("足す：メールと役割を送り、結果を出して一覧を読み直す", async () => {
    asAdmin();
    routes["POST /api/v1/teacher/members"] = (body) => json({ member: body }, 201);
    render(<MembersPage />);
    fireEvent.change(await screen.findByLabelText(MEMBERS_COPY.emailLabel), { target: { value: "new@school.example" } });
    fireEvent.change(screen.getByLabelText(MEMBERS_COPY.colRole), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: MEMBERS_COPY.add }));
    expect(await screen.findByText(MEMBERS_COPY.added("new@school.example", MEMBERS_COPY.admin))).toBeTruthy();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ email: "new@school.example", role: "admin" });
    expect(calls.filter((call) => call.path === "/api/v1/teacher/members" && call.method === "GET").length).toBe(2);
  });

  it("足す：学校のドメインの外は、断られた理由を欄の近くに出す", async () => {
    asAdmin();
    routes["POST /api/v1/teacher/members"] = () => json({ error: { code: "ADULT_INVALID_REQUEST", details: [{ field: "email", reason: "domain" }] } }, 400);
    render(<MembersPage />);
    fireEvent.change(await screen.findByLabelText(MEMBERS_COPY.emailLabel), { target: { value: "x@gmail.com" } });
    fireEvent.click(screen.getByRole("button", { name: MEMBERS_COPY.add }));
    expect(await screen.findByText(MEMBERS_COPY.emailDomain)).toBeTruthy();
  });

  it("役割の変更：もう一方の役割で送る", async () => {
    asAdmin();
    routes["POST /api/v1/teacher/members"] = (body) => json({ member: body });
    render(<MembersPage />);
    const row = (await screen.findByText("two@school.example")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: MEMBERS_COPY.makeAdmin }));
    expect(await screen.findByText(MEMBERS_COPY.changed("two@school.example", MEMBERS_COPY.admin))).toBeTruthy();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ email: "two@school.example", role: "admin" });
  });

  it("外す：確認を出し、確かめてから DELETE を送る。やめるなら送らない", async () => {
    asAdmin();
    routes["DELETE /api/v1/teacher/members/two%40school.example"] = () => json({ email: "two@school.example" });
    render(<MembersPage />);
    const row = (await screen.findByText("two@school.example")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: MEMBERS_COPY.remove }));
    const panel = screen.getByRole("group", { name: MEMBERS_COPY.remove });
    expect(within(panel).getByText(MEMBERS_COPY.confirmRemove("two@school.example"))).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: MEMBERS_COPY.cancel }));
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);

    fireEvent.click(within(row).getByRole("button", { name: MEMBERS_COPY.remove }));
    fireEvent.click(within(screen.getByRole("group", { name: MEMBERS_COPY.remove })).getByRole("button", { name: MEMBERS_COPY.remove }));
    expect(await screen.findByText(MEMBERS_COPY.removed("two@school.example"))).toBeTruthy();
    expect(calls.some((call) => call.method === "DELETE" && call.path === "/api/v1/teacher/members/two%40school.example")).toBe(true);
  });

  it("外す：最後の管理者などで断られたら、その理由を出す", async () => {
    asAdmin();
    routes["DELETE /api/v1/teacher/members/two%40school.example"] = () => json({ error: { code: "LAST_ADMIN" } }, 409);
    render(<MembersPage />);
    const row = (await screen.findByText("two@school.example")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: MEMBERS_COPY.remove }));
    fireEvent.click(within(screen.getByRole("group", { name: MEMBERS_COPY.remove })).getByRole("button", { name: MEMBERS_COPY.remove }));
    expect(await screen.findByText(MEMBERS_COPY.lastAdmin)).toBeTruthy();
  });
});
