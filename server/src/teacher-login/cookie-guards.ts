// 先生の Cookie（__session）に関わる、経路の手前の守り。TEACHER_LOGIN が on のときだけ掛かる（off のときの動きは変えない）。
import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { apiFailure } from "../errors.ts";
import { SESSION_COOKIE } from "./session.ts";
import type { TeacherLoginSettings } from "./config.ts";

const CACHE_CONTROL = "private, no-store";

/**
 * __session の付いた、GET・HEAD 以外の要求は、Origin があって PUBLIC_BASE_URL と違えば 403 で断る（#363 の 2）。
 * SameSite=Lax に加えて、別のサイトの画面から先生の Cookie で書き込まれるのを防ぐ。Origin が無い要求（同じ場所の古い送り方、curl）は通す
 */
export function registerOriginGuard<Env extends object>(app: Hono<Env>, settings: TeacherLoginSettings): void {
  if (!settings.enabled) return;
  const { origin } = settings;
  app.use("/api/v1/*", async (context, next) => {
    const method = context.req.method;
    if (method === "GET" || method === "HEAD" || getCookie(context, SESSION_COOKIE) === undefined) return next();
    const given = context.req.header("origin");
    if (given === undefined || given === origin) return next();
    const failure = apiFailure("FORBIDDEN");
    return context.json(failure.body, failure.status as 403);
  });
}

/** Cookie で中身が変わる応答を、Hosting の CDN や共有の入れ物に残さない */
export function registerPrivateCacheHeaders<Env extends object>(app: Hono<Env>, settings: TeacherLoginSettings): void {
  if (!settings.enabled) return;
  const mark = async (context: { header: (name: string, value: string) => void }, next: () => Promise<void>) => {
    await next();
    context.header("Cache-Control", CACHE_CONTROL);
  };
  app.use("/api/v1/teacher/*", mark);
  app.use("/api/v1/workspace", mark);
  // 学びの輪は、Cookie の学級ごとに中身が変わる（#423）
  for (const path of ["/api/v1/audit-log", "/api/v1/loop/*", "/api/v1/themes/*", "/api/v1/approved-hints", "/api/v1/stumbles/*"]) app.use(path, mark);
  app.use("/api/v1/print/handouts", async (context, next) => {
    if (context.req.method !== "GET") return next();
    return mark(context, next);
  });
}
