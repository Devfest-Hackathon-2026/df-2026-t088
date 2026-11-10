import { afterEach, describe, expect, it, vi } from "vitest";
import { listAdminAssignments, readClassProgress, readTimetable } from "./api";
import { setApproverKey } from "./approver-key";

afterEach(() => {
  setApproverKey("");
  vi.unstubAllGlobals();
});

describe("先生の管理 API", () => {
  it("共有した承認キーを読み出し API に付ける", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    setApproverKey("shared-key");

    await listAdminAssignments();
    await readClassProgress();
    await readTimetable();

    expect(fetchMock.mock.calls.map((call) => call[1]?.headers)).toEqual([
      { "x-approver-key": "shared-key" },
      { "x-approver-key": "shared-key" },
      { "x-approver-key": "shared-key" },
    ]);
  });

  it("承認キーを保存領域に書かない", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setApproverKey("memory-only");
    expect(setItem).not.toHaveBeenCalled();
  });
});
