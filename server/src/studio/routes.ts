import type { Env, Hono } from "hono";
import { apiFailure } from "../errors.ts";
import type { LoopStore } from "../loop/store.ts";
import type { DailyTotal } from "../workspace/daily-total.ts";
import { registerStudioCompileRoutes } from "./compile-routes.ts";
import { registerStudioTournamentRoutes } from "./tournament-routes.ts";
import { registerStudioVersionRoutes } from "./version-routes.ts";

// 承認と取り消しは、学びの輪と同じ承認キーと監査の記録を使う
// Gemini を呼ぶ 3 つの POST。全体の 1 日の上限で止める
const STUDIO_AI_PATHS = new Set(["/api/v1/studio/compile", "/api/v1/studio/patch-draft", "/api/v1/studio/tournament"]);

export function registerStudioRoutes<E extends Env>(app: Hono<E>, options: { loopStore?: LoopStore; approverKey?: string; aiTotal?: DailyTotal } = {}): void {
  const { aiTotal } = options;
  // 各経路より先に掛ける。認証は足さない（画面の今の動きを変えない）。上限で止めた要求は Gemini に届かない
  if (aiTotal) {
    app.use("/api/v1/studio/*", async (context, next) => {
      if (context.req.method !== "POST" || !STUDIO_AI_PATHS.has(context.req.path)) return next();
      const at = new Date();
      if (!aiTotal.available(at)) {
        const failure = apiFailure("RATE_LIMITED");
        return context.json(failure.body, failure.status as 429);
      }
      aiTotal.add(at);
      return next();
    });
  }
  registerStudioCompileRoutes(app);
  registerStudioTournamentRoutes(app);
  registerStudioVersionRoutes(app, { approverKey: options.approverKey, auditStore: options.loopStore });
}
