import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioPanel } from "./StudioPanel";
import type { StudioApi } from "./StudioPanel";

describe("StudioPanel", () => {
  it("見本データで生成、検査、承認、版の更新まで進む", async () => {
    render(<StudioPanel />);

    expect(screen.getByText("mock（本物の Gemini ではない）")).toBeTruthy();
    expect(screen.getByText(/ダミーのデータで動くデモ/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分母をそろえる教材を作る" } });
    fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));

    expect(await screen.findByText("検査に通りました" )).toBeTruthy();
    expect(screen.getByRole("region", { name: "教材プレビュー" }).textContent).toContain("分母をそろえる意味をタイルで考えます");
    expect(screen.getByText("現在の版：版 1")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "内容を確認しました" } });
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(await screen.findByText(/状態：承認済み/)).toBeTruthy();
    expect(screen.getByText(/状態：承認済み/)).toBeTruthy();
  });

  it("承認・取り消しには x-approver-key を渡す", async () => {
    const decide = vi.fn(async () => ({ status: "approved" as const, version: 2, mode: "real" as const }));
    const revoke = vi.fn(async () => ({ status: "revoked" as const, version: 3, mode: "real" as const }));
    const api: StudioApi = {
      generate: async () => ({ draftId: "draft-1", lesson: { schemaVersion: 1, objective: "分数を考えます", strategy: "visual", problems: [] }, validation: { ok: true }, version: 1, mode: "real" }),
      decide,
      revoke,
    };
    render(<StudioPanel api={api} approverKey="key-123" />);
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分数を考える" } });
    fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));
    await screen.findByText("検査に通りました");
    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "承認の理由" } });
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    await screen.findByText(/状態：承認済み/);
    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "内容を見直します" } });
    fireEvent.click(screen.getByRole("button", { name: "承認を取り消す" }));
    await screen.findByText(/状態：取り消し済み/);

    expect(decide).toHaveBeenCalledWith("draft-1", "approved", "承認の理由", { "x-approver-key": "key-123" }, 1);
    expect(revoke).toHaveBeenCalledWith("draft-1", "内容を見直します", { "x-approver-key": "key-123" }, 2);
  });

  it("画面上部から渡されたキーを使い、スタジオ内には入力欄を出さない", async () => {
    const decide = vi.fn(async () => ({ status: "approved" as const, version: 1, mode: "real" as const }));
    const api: StudioApi = {
      generate: async () => ({ draftId: "draft-shared", lesson: { schemaVersion: 1, objective: "分数を考えます", strategy: "visual", problems: [] }, validation: { ok: true }, version: 1, mode: "real" }),
      decide,
      revoke: async () => ({ status: "revoked", version: 1, mode: "real" }),
    };
    render(<StudioPanel api={api} approverKey="shared-key" />);
    expect(screen.queryByLabelText("承認キー")).toBeNull();
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分数を考える" } });
    fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));
    await screen.findByText("検査に通りました");
    expect(screen.getByText("承認キーは画面の上の欄に入れてください")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "承認の理由" } });
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    await screen.findByText(/状態：承認済み/);
    expect(decide).toHaveBeenCalledWith("draft-shared", "approved", "承認の理由", { "x-approver-key": "shared-key" }, 1);
  });

  it("検査の理由をそのまま表示し、作り直し中と失敗を知らせる", async () => {
    let resolveGenerate: ((value: Awaited<ReturnType<StudioApi["generate"]>>) => void) | undefined;
    const api: StudioApi = {
      generate: vi.fn(() => new Promise<Awaited<ReturnType<StudioApi["generate"]>>>((resolve) => { resolveGenerate = resolve; })),
      decide: vi.fn(),
      revoke: vi.fn(),
    };
    const { rerender } = render(<StudioPanel api={api} />);
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分数を考える" } });
    fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));
    expect(within(screen.getByRole("region", { name: "教材スタジオ" })).getByRole("status").textContent).toMatch(/生成中/);
    await act(async () => { resolveGenerate?.({ draftId: "draft-2", lesson: { schemaVersion: 1, objective: "分数を考えます", strategy: "visual", problems: [] }, validation: { ok: false, issues: ["検査の日本語をそのまま表示します。"] }, version: 1, mode: "mock" }); });
    expect(await screen.findByText("検査の日本語をそのまま表示します。")).toBeTruthy();

    const failedApi: StudioApi = { ...api, generate: vi.fn().mockRejectedValue(new Error("生成に失敗しました")) };
    rerender(<StudioPanel api={failedApi} />);
    fireEvent.click(screen.getByRole("button", { name: "作り直す" }));
    await waitFor(() => expect(screen.getByText("生成に失敗しました")).toBeTruthy());
  });

  it("本物の API の応答では mock 表示を出さない", async () => {
    const api: StudioApi = {
      generate: async () => ({ draftId: "draft-real", lesson: { schemaVersion: 1, objective: "分数を考えます", strategy: "visual", problems: [] }, validation: { ok: true }, version: 1, mode: "real" }),
      decide: async () => ({ status: "approved", version: 2, mode: "real" }),
      revoke: async () => ({ status: "revoked", version: 3, mode: "real" }),
    };
    render(<StudioPanel api={api} />);
    fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分数を考える" } });
    fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));
    await screen.findByText("検査に通りました");
    expect(screen.queryByText("mock（本物の Gemini ではない）")).toBeNull();
  });
});
