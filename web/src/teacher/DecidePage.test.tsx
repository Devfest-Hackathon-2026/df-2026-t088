import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecidePage } from "./DecidePage";
import { DECIDE_COPY } from "./copy";

type Call = { method: string; path: string; body: Record<string, unknown> | undefined; headers: Record<string, string> };
type Reply = { status: number; json: unknown };

let calls: Call[] = [];
let routes: Record<string, (call: Call) => Reply> = {};

const suggestion = { id: "s-1", status: "pending", generatedBy: "table", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", replacesHintIndex: 0, hint: "まず同じ大きさにそろえよう", basis: { count: 6 } };

beforeEach(() => {
  calls = [];
  routes = {
    "POST /api/v1/suggestions": () => ({ status: 200, json: suggestion }),
  };
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const path = String(input).split("?")[0] ?? "";
    const call: Call = {
      method: init?.method ?? "GET",
      path,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: { ...(init?.headers as Record<string, string> | undefined) },
    };
    calls.push(call);
    const reply = routes[`${call.method} ${path}`]?.(call) ?? { status: 404, json: { error: { code: "NOT_FOUND", message: "未設定" } } };
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => vi.unstubAllGlobals());

const page = () => render(<DecidePage lessonKey="main-6" problem="1/3+1/4" pattern="sum-both" />);
const decisions = () => calls.filter((c) => c.method === "POST" && c.path.endsWith("/decision"));

describe("DecidePage（SCR-T03 直し方の承認）", () => {
  it("未決の提案の文を出す。理由が空のまま押すと、理由の注を出し、決めない", async () => {
    routes["POST /api/v1/suggestions/s-1/decision"] = () => ({ status: 200, json: { id: "s-1", status: "approved", replaced: [] } });
    page();
    expect(await screen.findByText("まず同じ大きさにそろえよう")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.approve }));
    expect(await screen.findByText(DECIDE_COPY.needReason)).toBeTruthy();
    expect(decisions().length).toBe(0);
  });

  it("理由を書いて承認すると、先生の役割と理由で送り、結果の文を出す", async () => {
    routes["POST /api/v1/suggestions/s-1/decision"] = () => ({ status: 200, json: { id: "s-1", status: "approved", replaced: [] } });
    page();
    await screen.findByText("まず同じ大きさにそろえよう");
    fireEvent.change(screen.getByLabelText(DECIDE_COPY.reasonLabel), { target: { value: "単位を先に示す方が手が動きそう" } });
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.approve }));
    expect(await screen.findByText(DECIDE_COPY.approvedDone)).toBeTruthy();
    expect(decisions()[0]?.body).toEqual({ role: "teacher", decision: "approved", reason: "単位を先に示す方が手が動きそう" });
  });

  it("断ると、断った文を出す", async () => {
    routes["POST /api/v1/suggestions/s-1/decision"] = () => ({ status: 200, json: { id: "s-1", status: "rejected", replaced: [] } });
    page();
    await screen.findByText("まず同じ大きさにそろえよう");
    fireEvent.change(screen.getByLabelText(DECIDE_COPY.reasonLabel), { target: { value: "今は出さない" } });
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.reject }));
    expect(await screen.findByText(DECIDE_COPY.rejectedDone)).toBeTruthy();
    expect(decisions()[0]?.body).toMatchObject({ decision: "rejected" });
  });

  it("承認キーが要るときは、キーの欄を出し、入れた後で送り直す", async () => {
    routes["POST /api/v1/suggestions/s-1/decision"] = (call) => {
      if (!call.headers["x-approver-key"]) return { status: 401, json: { error: { code: "UNAUTHORIZED", message: "x" } } };
      return { status: 200, json: { id: "s-1", status: "approved", replaced: [] } };
    };
    page();
    await screen.findByText("まず同じ大きさにそろえよう");
    fireEvent.change(screen.getByLabelText(DECIDE_COPY.reasonLabel), { target: { value: "理由" } });
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.approve }));
    expect(await screen.findByText(DECIDE_COPY.keyNeeded)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(DECIDE_COPY.keyLabel), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.approve }));
    expect(await screen.findByText(DECIDE_COPY.approvedDone)).toBeTruthy();
    expect(decisions().length).toBe(2);
  });

  it("もう決まっている直し方は、その文を出し、決める欄を出さない", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 200, json: { ...suggestion, status: "approved" } });
    page();
    expect(await screen.findByText(DECIDE_COPY.alreadyDecided)).toBeTruthy();
    expect(screen.queryByRole("button", { name: DECIDE_COPY.approve })).toBeNull();
  });

  it("決める途中で失敗したら、短い文を出す", async () => {
    routes["POST /api/v1/suggestions/s-1/decision"] = () => ({ status: 500, json: { error: { code: "X", message: "x" } } });
    page();
    await screen.findByText("まず同じ大きさにそろえよう");
    fireEvent.change(screen.getByLabelText(DECIDE_COPY.reasonLabel), { target: { value: "理由" } });
    fireEvent.click(screen.getByRole("button", { name: DECIDE_COPY.approve }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(DECIDE_COPY.failed));
  });
});
