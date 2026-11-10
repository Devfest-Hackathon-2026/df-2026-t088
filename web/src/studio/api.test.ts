import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnectedStudioApi, STUDIO_MOCK_LESSON } from "./api";
import type { StudioApi } from "./StudioPanel";

const fallback: StudioApi = {
  async generate() { return { draftId: "fallback", lesson: STUDIO_MOCK_LESSON, validation: { ok: true }, version: 1, mode: "mock" }; },
  async decide(_id, decision, _reason, _headers, version = 1) { return { status: decision, version, mode: "mock" }; },
  async revoke(_id, _reason, _headers, version = 1) { return { status: "revoked", version, mode: "mock" }; },
  async createRevision(draft) { return draft; },
  async tournament() { return { alternatives: [] }; },
  async adopt(lesson) { return { draftId: "fallback", lesson, validation: { ok: true }, version: 1, mode: "mock" }; },
};

function version(number: number, lessonId = "lesson-1") {
  return { id: `${lessonId}@v${number}`, lessonId, number, lesson: STUDIO_MOCK_LESSON, validation: { ok: true as const } };
}

describe("createConnectedStudioApi generation evidence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends compile, tournament-selection, and patch-draft generation metadata when saving versions", async () => {
    const requests: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      requests.push({ path, body });
      if (path.endsWith("/compile")) return Response.json({ lesson: STUDIO_MOCK_LESSON, source: "gemini", model: "compile-model", elapsedMs: 25, validation: { ok: true } });
      if (path.endsWith("/patch-draft")) return Response.json({ patch: { baseVersion: 1, operations: [{ type: "setStrategy", strategy: "numeric" }] }, source: "mock", model: "patch-model", elapsedMs: 5 });
      if (path.endsWith("/tournament")) return Response.json({ alternatives: [{ strategy: "visual", lesson: STUDIO_MOCK_LESSON, source: "gemini", model: "tournament-model", elapsedMs: 30 }] });
      if (path.endsWith("/patch")) return Response.json({ version: version(2) });
      if (path.endsWith("/lessons")) return Response.json(version(1, `lesson-${requests.length}`));
      throw new Error(`Unexpected request: ${path}`);
    }));

    const api = createConnectedStudioApi(fallback);
    await api.generate("fraction-addition", "分数教材");
    expect(requests.find((request) => request.path.endsWith("/lessons"))?.body.generation).toEqual({ source: "gemini", model: "compile-model", elapsedMs: 25 });

    const alternatives = await api.tournament?.("分数教材");
    const alternative = alternatives?.alternatives[0];
    if (!alternative?.lesson) throw new Error("tournament lesson missing");
    await api.adopt?.(alternative.lesson, "real");
    expect(requests.filter((request) => request.path.endsWith("/lessons")).at(-1)?.body.generation).toEqual({ source: "gemini", model: "tournament-model", elapsedMs: 30 });

    await api.createRevision?.({ draftId: "lesson-1", lessonId: "lesson-1", lesson: STUDIO_MOCK_LESSON, validation: { ok: true }, version: 1, mode: "real" }, "直してください");
    expect(requests.find((request) => request.path.endsWith("/patch"))?.body.generation).toEqual({ source: "mock", model: "patch-model", elapsedMs: 5 });
  });
  it("takes the restored version number and lesson when the server returns a version object on revoke", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("/revoke")) return Response.json({ status: "revoked", currentVersion: { ...version(1), baseVersion: null, status: "published" }, revokedVersion: { ...version(2), status: "revoked" } });
      throw new Error(`Unexpected request: ${path}`);
    }));
    const result = await createConnectedStudioApi(fallback).revoke("lesson-1", "見直すため", {}, 2);
    expect(result.status).toBe("revoked");
    expect(result.version).toBe(1);
    expect(result.lesson).toEqual(STUDIO_MOCK_LESSON);
    expect(result.fallbackReason).toBeUndefined();
  });

  it("still accepts a numeric currentVersion on revoke", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "revoked", currentVersion: 1 })));
    const result = await createConnectedStudioApi(fallback).revoke("lesson-1", "見直すため", {}, 2);
    expect(result.version).toBe(1);
  });
});
