import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, call } from "../research/api";
import { LoopAssistantCard } from "./LoopAssistantCard";
import { setApproverKey } from "./approver-key";
import { TeacherSessionContext } from "./workspace";

vi.mock("../research/api", () => ({
  call: vi.fn(),
  NAMED_PATTERNS: ["sum-both", "sum-num-only", "same-den-sum", "lever-same-weight", "lever-inverse"],
  DEMO_PROBLEM: { lessonKey: "main-6", problem: "1/3+1/4" },
  ApiError: class ApiError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } },
}));

const mockedCall = vi.mocked(call);
const row = {
  chapterId: "fraction", lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", count: 6,
  status: "pending", source: "dummy",
  suggestion: { id: "suggestion-1", candidates: [
    { number: 1, source: "gemini", hint: "同じ大きさにそろえよう", passed: true },
    { number: 2, source: "table", hint: "分母をそろえよう", passed: true },
    { number: 3, source: "gemini", hint: "答えは7/12です", passed: false, reason: "leak" },
  ] },
  effect: { status: "undetermined", before: { count: 0, correct: null }, after: { count: 0, correct: null }, tryAlternatives: false, alternatives: [] },
};

describe("学びの輪アシスタントカード", () => {
  beforeEach(() => {
    mockedCall.mockReset();
    mockedCall.mockResolvedValue({ items: [row] } as never);
  });

  it("見本の型と検査に通った案を出し、選んだ案を承認する", async () => {
    render(<LoopAssistantCard />);
    expect(await screen.findByText("型: 分子どうし、分母どうしを計算した形")).toBeTruthy();
    // 内部の ID（fraction・main-6）ではなく、単元の名前で出す（#535）
    expect(screen.getByText("分数 7マス目・1/3+1/4")).toBeTruthy();
    expect(screen.queryByText(/main-6/)).toBeNull();
    // 理由が要ることは、押す前から欄の名前で分かる
    expect((screen.getByLabelText("理由（必須）") as HTMLInputElement).required).toBe(true);
    expect(screen.getByText("6 件")).toBeTruthy();
    expect(screen.getByText("見本")).toBeTruthy();
    expect(screen.getByText("同じ大きさにそろえよう")).toBeTruthy();
    expect(screen.queryByText("答えは7/12です")).toBeNull();
    fireEvent.change(screen.getByLabelText("直し方の案"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    expect(await screen.findByText("理由を書いてください（確かめたことを短く）")).toBeTruthy();
    expect(mockedCall.mock.calls.some(([, path]) => String(path).endsWith("/decision"))).toBe(false);
    fireEvent.change(screen.getByLabelText("理由（必須）"), { target: { value: "単位を先に示す方が手が動きそう" } });
    fireEvent.click(screen.getByRole("button", { name: "承認" }));
    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith(
      "POST", "/api/v1/suggestions/suggestion-1/decision",
      { role: "teacher", decision: "approved", candidateNumber: 2, reason: "単位を先に示す方が手が動きそう" }, {},
    ));
  });

  it("プリントのてこは、教科の id・print: のキー・数字だけの問題を出さず、読める名前で出す", async () => {
    mockedCall.mockResolvedValue({ items: [{ ...row, chapterId: "rika", lessonKey: "print:rika-lever", problem: "左2-30g-右3", pattern: "lever-same-weight", source: "demo" }] } as never);
    render(<LoopAssistantCard />);
    expect(await screen.findByText("プリント（てこ）・左の 2 の目もりに 30g、右は 3 の目もり")).toBeTruthy();
    expect(screen.queryByText(/rika|print:|左2-30g/)).toBeNull();
  });

  it("承認した案を見せ、理由を添えて承認を取り消せる", async () => {
    const approved = { ...row, status: "approved", suggestion: { ...row.suggestion, selectedCandidateNumber: 2 } };
    mockedCall.mockResolvedValue({ items: [approved] } as never);
    render(<LoopAssistantCard />);
    expect(await screen.findByText("承認した案: 分母をそろえよう")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "承認を取り消す" }));
    expect(await screen.findByText("取り消す理由を書いてください")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("理由（必須）"), { target: { value: "内容を見直す" } });
    fireEvent.click(screen.getByRole("button", { name: "承認を取り消す" }));
    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith(
      "POST", "/api/v1/suggestions/suggestion-1/revoke", { role: "teacher", reason: "内容を見直す" }, {},
    ));
  });

  it("見本を入れる操作でまとめ API を1回呼ぶ", async () => {
    render(<LoopAssistantCard />);
    fireEvent.click(await screen.findByRole("button", { name: "見本を入れる" }));
    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith("POST", "/api/v1/loop/assistant/samples", { stage: "base" }, {}));
    expect(mockedCall.mock.calls.filter(([method, path]) => method === "POST" && path === "/api/v1/loop/assistant/samples")).toHaveLength(1);
  });

  it("型の名前は日本語で出し、内部の id を出さない (#375)", async () => {
    render(<LoopAssistantCard />);
    expect(await screen.findByText("型: 分子どうし、分母どうしを計算した形")).toBeTruthy();
    expect(screen.queryByText(/sum-both/)).toBeNull();
  });

  it("学級に入っているときは承認キーを付けず、権限が無くても承認キーを求めない。入っていないときは今のまま", async () => {
    setApproverKey("stale-key");
    mockedCall.mockRejectedValue(new ApiError("UNAUTHORIZED", "x"));
    const view = render(
      <TeacherSessionContext.Provider value={{ session: { workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }, setWorkspace: () => {} }}>
        <LoopAssistantCard />
      </TeacherSessionContext.Provider>,
    );
    expect(await screen.findByText("ログインが切れました。ページを開き直して、もう一度入ってください")).toBeTruthy();
    expect(screen.queryByText(/承認キー/)).toBeNull();
    expect(mockedCall).toHaveBeenCalledWith("GET", "/api/v1/loop/assistant", undefined, {});
    view.unmount();

    mockedCall.mockClear();
    render(<LoopAssistantCard />);
    expect(await screen.findByText("画面の上の「承認キー」を入れてください")).toBeTruthy();
    expect(mockedCall).toHaveBeenCalledWith("GET", "/api/v1/loop/assistant", undefined, { "x-approver-key": "stale-key" });
    setApproverKey("");
  });

  it("承認前後の割合と注意書きを表示し、低下時に別案を試せる", async () => {
    const approved = {
      ...row,
      status: "approved",
      suggestion: { ...row.suggestion, selectedCandidateNumber: 1 },
      effect: { status: "compared", before: { count: 5, correct: 0.8 }, after: { count: 5, correct: 0.2 }, tryAlternatives: true, alternatives: [row.suggestion.candidates[1]!] },
    };
    mockedCall.mockResolvedValue({ items: [approved] } as never);
    render(<LoopAssistantCard />);
    expect(await screen.findByText((text) => text.includes("承認前 80%（5件）") && text.includes("承認後 20%（5件）"))).toBeTruthy();
    expect(screen.getByText(/学習効果の証明ではありません/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "別の案を試す" }));
    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith("POST", "/api/v1/loop/assistant/suggestion-1/alternatives", {}, {}));
  });
});

describe("見本を入れる（#377）", () => {
  it("混んでいる（429）ときは「混み合っています」を出す", async () => {
    mockedCall.mockReset();
    mockedCall.mockResolvedValueOnce({ items: [row] } as never);
    mockedCall.mockRejectedValueOnce(new ApiError("RATE_LIMITED", "x"));
    render(<LoopAssistantCard />);
    fireEvent.click(await screen.findByRole("button", { name: "見本を入れる" }));
    expect((await screen.findByRole("alert")).textContent).toBe("混み合っています。少し待ってからもう一度押してください");
  });
});
