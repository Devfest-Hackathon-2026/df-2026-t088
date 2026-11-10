import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAssignments, readTimetable } from "./api";
import { useHomeData } from "./use-home-data";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  readAssignments: vi.fn(),
  readTimetable: vi.fn(),
}));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const assignmentsOf = (now: string) => ({ now, assignments: [] });
const timetableOf = (now: string) => ({ now, days: [] });

describe("useHomeData の再読み込み", () => {
  beforeEach(() => vi.clearAllMocks());

  it("古い読み込みの応答が後から届いても、新しい応答を上書きしない（提出物・時間割）", async () => {
    const a1 = deferred<ReturnType<typeof assignmentsOf>>();
    const a2 = deferred<ReturnType<typeof assignmentsOf>>();
    const t1 = deferred<ReturnType<typeof timetableOf>>();
    const t2 = deferred<ReturnType<typeof timetableOf>>();
    vi.mocked(readAssignments).mockReturnValueOnce(a1.promise as never).mockReturnValueOnce(a2.promise as never);
    vi.mocked(readTimetable).mockReturnValueOnce(t1.promise as never).mockReturnValueOnce(t2.promise as never);

    const { result } = renderHook(() => useHomeData(vi.fn()));
    act(() => result.current.reload());

    await act(async () => { a2.resolve(assignmentsOf("new")); t2.resolve(timetableOf("new")); });
    await waitFor(() => expect(result.current.assignments).toEqual({ status: "ready", data: assignmentsOf("new") }));
    expect(result.current.timetable).toEqual({ status: "ready", data: timetableOf("new") });

    await act(async () => { a1.resolve(assignmentsOf("old")); t1.resolve(timetableOf("old")); });
    expect(result.current.assignments).toEqual({ status: "ready", data: assignmentsOf("new") });
    expect(result.current.timetable).toEqual({ status: "ready", data: timetableOf("new") });
  });
});
