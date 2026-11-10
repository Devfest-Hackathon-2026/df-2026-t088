// 先生のログインの経路。/api/v1/teacher/login → Google → /api/v1/teacher/callback → 先生の画面へ戻る。
// 設定が無いとき（TEACHER_LOGIN が on でない）は、me だけが enabled:false を返す。
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { authorizationUrl, challengeOf, exchangeCode, randomToken, verifyIdToken, type Identity, type OidcConfig } from "./oidc.ts";
import { readLoginState, SESSION_COOKIE, SESSION_HOURS, sameText, sessionCookieOptions, sessionSubject, signLoginState, signSession, subjectOf } from "./session.ts";
import type { TeacherLoginSettings } from "./config.ts";
import { normalizeEmail, type Member } from "../teacher-members/store.ts";
import type { Workspace } from "../workspace/store.ts";

export type TeacherLoginDeps = {
  exchange?: (config: OidcConfig, code: string, verifier: string) => Promise<string>;
  verify?: (config: OidcConfig, idToken: string, nonce: string) => Promise<Identity>;
  now?: () => Date;
};

// 先生の Cookie が有効かを、経路の外（loop など）から同期で確かめる
// 通すのは、印（sub）があり、「名簿にいる」か「（open・guest のとき）その印の学級がある」人だけ。印の無い古い Cookie は通さない（#363 の 1）
// 名簿から外された人の Cookie は、名簿だけで入る設定（roster）ではその時点で使えない（#351）。学級があるだけでは通さない
export function teacherSessionValid(settings: TeacherLoginSettings, context: Context, now: Date = new Date()): boolean {
  if (!settings.enabled) return false;
  const subject = sessionSubject(settings.sessionSecret, getCookie(context, SESSION_COOKIE), now);
  if (subject === undefined) return false;
  if (teacherMemberOf(settings, context, now) !== undefined) return true;
  return (settings.signup === "open" || settings.signup === "guest") && settings.workspaces.byOwner(subject) !== undefined;
}

/** いまログインしている人の、名簿の行（役割を含む）。印の無い Cookie、名簿にいない人、ログイン off は undefined */
export function teacherMemberOf(settings: TeacherLoginSettings, context: Context, now: Date = new Date()): Member | undefined {
  if (!settings.enabled) return undefined;
  const subject = sessionSubject(settings.sessionSecret, getCookie(context, SESSION_COOKIE), now);
  if (subject === undefined) return undefined;
  return settings.members.list().find((member) => subjectOf(settings.sessionSecret, member.email) === subject);
}

/**
 * いまログインしている先生の学級。ログインしていない・無効な Cookie は undefined。
 * 名簿にいる先生の学級が（再起動などで）無ければ、ここで用意する。学級の数が上限なら undefined
 */
export function teacherWorkspaceOf(settings: TeacherLoginSettings, context: Context, now: Date = new Date()): Workspace | undefined {
  if (!settings.enabled || !teacherSessionValid(settings, context, now)) return undefined;
  const subject = sessionSubject(settings.sessionSecret, getCookie(context, SESSION_COOKIE), now);
  if (subject === undefined) return undefined;
  const found = settings.workspaces.byOwner(subject);
  if (found) return found;
  const created = settings.workspaces.ensureFor(subject, now);
  return created === "full" ? undefined : created;
}

/** 学級の持ち主の印。学級を引ける先生だけに返す（学級の名前を直す経路が使う） */
export function teacherOwnerOf(settings: TeacherLoginSettings, context: Context, now: Date = new Date()): string | undefined {
  if (!settings.enabled || teacherWorkspaceOf(settings, context, now) === undefined) return undefined;
  return sessionSubject(settings.sessionSecret, getCookie(context, SESSION_COOKIE), now);
}

export function registerTeacherLoginRoutes<Env extends object>(app: Hono<Env>, settings: TeacherLoginSettings, deps: TeacherLoginDeps = {}): void {
  const now = deps.now ?? (() => new Date());

  app.get("/api/v1/teacher/me", (context) => {
    if (!settings.enabled) return context.json({ enabled: false, signedIn: false });
    if (!teacherSessionValid(settings, context, now())) return context.json({ enabled: true, signedIn: false, signup: settings.signup });
    const workspace = teacherWorkspaceOf(settings, context, now());
    return context.json({
      enabled: true,
      signedIn: true,
      // 名簿にいない人（open で入った人）は先生。管理者は名簿にしかいない
      role: teacherMemberOf(settings, context, now())?.role ?? "teacher",
      signup: settings.signup,
      ...(workspace ? { workspace: { id: workspace.id, name: workspace.name, joinCode: workspace.joinCode, childCapture: workspace.childCapture } } : {}),
    });
  });

  if (!settings.enabled) return;

  const cookie = sessionCookieOptions(settings.secure);
  // guest には Google のログインが無い（login・callback は 404。学級は POST /api/v1/teacher/guest で作る）
  const oidc = settings.oidc;
  if (oidc) {
    app.get("/api/v1/teacher/login", (context) => {
      const login = { state: randomToken(), nonce: randomToken(), verifier: randomToken() };
      setCookie(context, SESSION_COOKIE, signLoginState(settings.sessionSecret, now(), login), { ...cookie, maxAge: 600 });
      return context.redirect(authorizationUrl(oidc, login.state, login.nonce, challengeOf(login.verifier)), 302);
    });

    app.get("/api/v1/teacher/callback", async (context) => {
      const failed = () => {
        deleteCookie(context, SESSION_COOKIE, { path: "/" });
        return context.redirect(`${settings.home}?login=failed`, 302);
      };
      const code = context.req.query("code");
      const state = context.req.query("state");
      const login = readLoginState(settings.sessionSecret, getCookie(context, SESSION_COOKIE), now());
      if (!code || !state || !login || !sameText(state, login.state)) return failed();
      try {
        const idToken = await (deps.exchange ?? exchangeCode)(oidc, code, login.verifier);
        const identity = await (deps.verify ?? verifyIdToken)(oidc, idToken, login.nonce);
        // 名簿（管理者が画面から足し外しする）にいる人か、TEACHER_SIGNUP=open のときだけ通す。roster では、名簿に無い人は学校のアカウントでも入れない
        const email = normalizeEmail(identity.email);
        if (!settings.members.get(email) && settings.signup !== "open") return failed();
        const subject = subjectOf(settings.sessionSecret, email);
        // 先生ごとに学級を 1 つ用意する。数の上限なら入れない
        if (settings.workspaces.ensureFor(subject, now()) === "full") return failed();
        setCookie(context, SESSION_COOKIE, signSession(settings.sessionSecret, now(), subject), { ...cookie, maxAge: SESSION_HOURS * 60 * 60 });
        return context.redirect(settings.home, 302);
      } catch {
        return failed();
      }
    });
  }

  app.post("/api/v1/teacher/logout", (context) => {
    deleteCookie(context, SESSION_COOKIE, { path: "/" });
    return context.json({ ok: true });
  });
}
