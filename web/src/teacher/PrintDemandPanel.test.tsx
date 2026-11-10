import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrintDemandPanel } from "./PrintDemandPanel";
import { setApproverKey } from "./approver-key";

afterEach(() => { vi.unstubAllGlobals(); setApproverKey(""); });

describe("PrintDemandPanel", () => {
  it("件数の多い順に上位5件を表示する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [
      { unitId: "sansu-6-01", unitName: "分数", count: 9 },
      { unitId: "rika-6-01", unitName: "物の燃え方", count: 8 },
      { unitId: "sansu-6-02", unitName: "文字", count: 7 },
      { unitId: "sansu-6-03", unitName: "図形", count: 6 },
      { unitId: "sansu-6-04", unitName: "比", count: 5 },
      { unitId: "sansu-6-05", unitName: "体積", count: 4 },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));
    render(<PrintDemandPanel />);
    expect(await screen.findByText("分数")).toBeTruthy();
    expect(screen.getByText("説明をつくると、子どもが撮ったときに動く説明が出せます")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("体積")).toBeNull();
  });

  it("キーが無くて断られたら承認キーを入れるよう案内し、キーを入れると読み直す", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValue(new Response(JSON.stringify({ items: [{ unitId: "sansu-6-01", unitName: "分数", count: 3 }] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PrintDemandPanel />);
    expect(await screen.findByText("画面の上の「承認キー」を入れてください")).toBeTruthy();
    act(() => setApproverKey("teacher-key"));
    expect(await screen.findByText("分数")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("403 で断られても「読み込めませんでした」ではなく承認キーを案内する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403, headers: { "content-type": "application/json" } })));
    render(<PrintDemandPanel />);
    expect(await screen.findByText("画面の上の「承認キー」を入れてください")).toBeTruthy();
    expect(screen.queryByText("需要を読み込めませんでした")).toBeNull();
  });

  it("401・403 以外の失敗は今までの文のまま", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500, headers: { "content-type": "application/json" } })));
    render(<PrintDemandPanel />);
    expect(await screen.findByText("需要を読み込めませんでした")).toBeTruthy();
  });
});
