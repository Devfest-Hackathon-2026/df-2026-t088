// 「お試しの学級をつくる」の経路（TEACHER_LOGIN=guest のときだけある。ほかの設定では 404）。
// Google を使わず、押した人に推測できない持ち主の印を渡して、その人の学級を 1 つ作る。決まりの正本は
// docs/product/education-api-contract.md「学級（ワークスペース）の API」。ログには、持ち主の印・学級の id・名前・コードを出さない。
import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { apiFailure } from "../errors.ts";
import { clientOf } from "../guard.ts";
import { readTotalPerDay } from "../workspace/daily-total.ts";
import { jstDay } from "../workspace/store.ts";
import type { TeacherLoginSettings } from "./config.ts";
import { teacherWorkspaceOf } from "./routes.ts";
import { SESSION_COOKIE, SESSION_HOURS, sessionCookieOptions, signSession } from "./session.ts";

/** 1 つの接続元が 1 日（日本時間）に作れる学級の数 */
export const GUEST_WORKSPACES_PER_CLIENT_PER_DAY = 10;

/** 接続元ごとの、今日作った学級の数（メモリ）。数えるのは作ったときだけなので、学級の上限（2000）より増えない */
function createCreationCounter() {
  const counts = new Map<string, number>();
  let day = "";
  const today = (now: Date) => {
    const current = jstDay(now);
    // 日が変わったら前の日の分は捨てる
    if (current !== day) {
      counts.clear();
      day = current;
    }
  };
  return {
    allowed(client: string, now: Date): boolean {
      today(now);
      return (counts.get(client) ?? 0) < GUEST_WORKSPACES_PER_CLIENT_PER_DAY;
    },
    add(client: string, now: Date): void {
      today(now);
      counts.set(client, (counts.get(client) ?? 0) + 1);
    },
  };
}

/** 全体で 1 時間に作れる学級の数の既定。接続元ごとの歯止めが外れても（x-forwarded-for を偽られても）、学級の上限が短時間で埋まらないようにする */
export const DEFAULT_GUEST_WORKSPACES_PER_HOUR = 200;
const HOUR_MS = 3_600_000;

/** 1 時間（時刻の区切り）ごとの全体の数え。作ったときだけ数える */
function createHourlyTotal(limit: number) {
  let hour = -1;
  let count = 0;
  const roll = (now: Date) => {
    const current = Math.floor(now.getTime() / HOUR_MS);
    if (current !== hour) {
      hour = current;
      count = 0;
    }
  };
  return {
    available(now: Date) { roll(now); return count < limit; },
    add(now: Date) { roll(now); count += 1; },
  };
}

export function registerGuestRoute<Env extends object>(app: Hono<Env>, settings: TeacherLoginSettings, now: () => Date = () => new Date(), environment: NodeJS.ProcessEnv = {}): void {
  if (!settings.enabled || settings.signup !== "guest") return;
  const created = createCreationCounter();
  const hourly = createHourlyTotal(readTotalPerDay(environment, "GUEST_WORKSPACES_PER_HOUR", DEFAULT_GUEST_WORKSPACES_PER_HOUR));

  app.post("/api/v1/teacher/guest", (context) => {
    const refuse = (code: Parameters<typeof apiFailure>[0], message?: string) => {
      const failure = apiFailure(code);
      return context.json(message ? { error: { ...failure.body.error, message } } : failure.body, failure.status as 403 | 429);
    };
    // Cookie の有る無しによらず、Origin が合うときだけ通す（他のサイトの画面から学級を作らせない）
    if (context.req.header("origin") !== settings.origin) return refuse("FORBIDDEN");

    const at = now();
    // 有効な __session があれば、新しく作らずにその学級を返す（押し直しで学級が増えない）
    const existing = teacherWorkspaceOf(settings, context, at);
    if (existing) return context.json({ workspace: { id: existing.id, name: existing.name, joinCode: existing.joinCode } });

    const client = clientOf(context);
    if (!created.allowed(client, at)) return refuse("RATE_LIMITED");
    if (!hourly.available(at)) return refuse("RATE_LIMITED", "いま、お試しの学級が たくさん作られています。少し待ってから もういちど押してください");
    const owner = randomUUID();
    const workspace = settings.workspaces.ensureFor(owner, at);
    if (workspace === "full") return refuse("STORE_FULL");
    created.add(client, at);
    hourly.add(at);
    setCookie(context, SESSION_COOKIE, signSession(settings.sessionSecret, at, owner), { ...sessionCookieOptions(settings.secure), maxAge: SESSION_HOURS * 60 * 60 });
    return context.json({ workspace: { id: workspace.id, name: workspace.name, joinCode: workspace.joinCode } });
  });
}
