// 学級（ワークスペース）の経路。決まりの正本は docs/product/education-api-contract.md「学級（ワークスペース）の API」。
// PATCH は先生（Cookie）だけ。join は子ども用で、ログインも承認キーも要らない（学級コードが入口）。
// ログには、メール・学級の名前・学級コードを出さない（このファイルでは何も出さない）。
import type { Context, Hono } from "hono";
import type { ApiErrorCode } from "../api-types.ts";
import { apiFailure } from "../errors.ts";
import { publicHandout, type PrintHandoutsStore } from "../print/handouts-store.ts";
import { normalizeWorkspaceName, type Workspace, type WorkspaceStore } from "./store.ts";

export type WorkspaceRouteOptions = {
  workspaces: WorkspaceStore;
  handouts: PrintHandoutsStore;
  /** 先生の Cookie が有効なときのその先生の学級の持ち主の印。無ければ undefined */
  ownerOf: (context: Context) => string | undefined;
};

// 学級コードは 6 文字。長すぎる値は引かずに断る
const JOIN_CODE_MAX = 16;

function fail(context: Context, code: ApiErrorCode): Response {
  const response = apiFailure(code);
  return context.json(response.body, response.status as 400 | 401 | 404 | 503);
}

export function registerWorkspaceRoutes<Env extends object>(app: Hono<Env>, options: WorkspaceRouteOptions): void {
  app.patch("/api/v1/workspace", async (context) => {
    const owner = options.ownerOf(context);
    if (owner === undefined) return fail(context, "UNAUTHORIZED");
    let body: unknown;
    try { body = await context.req.json(); } catch { return fail(context, "ADULT_INVALID_REQUEST"); }
    // name と childCapture のどちらか 1 つ以上。ほかの項目と、形の違う値は 400（どちらも変えない）
    if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(context, "ADULT_INVALID_REQUEST");
    const keys = Object.keys(body);
    if (keys.length === 0 || keys.some((key) => key !== "name" && key !== "childCapture")) return fail(context, "ADULT_INVALID_REQUEST");
    const { name: rawName, childCapture } = body as { name?: unknown; childCapture?: unknown };
    const name = keys.includes("name") ? normalizeWorkspaceName(rawName) : undefined;
    if (keys.includes("name") && name === undefined) return fail(context, "ADULT_INVALID_REQUEST");
    if (keys.includes("childCapture") && typeof childCapture !== "boolean") return fail(context, "ADULT_INVALID_REQUEST");
    let changed: Workspace | undefined = options.workspaces.byOwner(owner);
    if (name !== undefined) changed = options.workspaces.rename(owner, name);
    if (typeof childCapture === "boolean") changed = options.workspaces.setChildCapture(owner, childCapture);
    return changed ? context.json(changed) : fail(context, "UNAUTHORIZED");
  });

  app.get("/api/v1/join/:code", async (context) => {
    const code = context.req.param("code");
    const workspace = code.length > JOIN_CODE_MAX ? undefined : options.workspaces.byJoinCode(code);
    if (!workspace) return fail(context, "NOT_FOUND");
    try {
      // 子どもが撮った説明（先生が確かめていない）は、ほかの子に配らないので出さない。応答にも origin は出さない
      const items = await options.handouts.list(workspace.id);
      return context.json({ name: workspace.name, childCapture: workspace.childCapture, items: items.map(publicHandout) });
    } catch {
      console.error("workspace handouts failure count=1");
      return fail(context, "BUSY");
    }
  });
}
