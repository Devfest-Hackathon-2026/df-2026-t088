// 先生のログインで使う Cookie。名前は __session の 1 つだけ（Firebase Hosting は、この名前の Cookie しか Cloud Run へ渡さない）。
// 中身は署名した JSON で、ログインの途中（kind: "oidc"。state・nonce・verifier。10 分）と、入った後（kind: "teacher"。sub。8 時間）がある。
// 入った後の中身は「先生である」ことと期限と、メールから作った印（sub）だけ。メールや Google の ID は入れない。
// 印は、メールから SESSION_SECRET で作った値（subjectOf）。名簿と学級を引き直して、役割（管理者か先生か）と学級を決める（#351）。
// 署名は HMAC-SHA256（秘密の鍵は環境変数 SESSION_SECRET）。検査は同期で行う（loop の経路の中で使うため）。
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__session";
export const SESSION_HOURS = 8;
export const LOGIN_STATE_MINUTES = 10;
export const MIN_SECRET_LENGTH = 32;

/** __session の属性。ログインの途中と入った後で同じ（期限だけ maxAge で変える） */
export const sessionCookieOptions = (secure: boolean) => ({ httpOnly: true, sameSite: "Lax" as const, path: "/", secure });

export type LoginState = { state: string; nonce: string; verifier: string };

const mac = (secret: string, body: string): string => createHmac("sha256", secret).update(body).digest("base64url");

/** 名簿の 1 人を指す印。メールそのものは Cookie に入れない。メールは小文字にした形で渡す */
export const subjectOf = (secret: string, email: string): string => mac(secret, `member:${email}`);

/** 文字列どうしを、長さによらず一定の時間で比べる */
export function sameText(given: string, expected: string): boolean {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function seal(secret: string, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(secret, body)}`;
}

/** 署名と期限を確かめて中身を返す。改ざん・期限切れ・形の誤りは null */
function unseal(secret: string, token: string | undefined, now: Date): Record<string, unknown> | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  if (!sameText(token.slice(dot + 1), mac(secret, body))) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    if (typeof record.exp !== "number" || record.exp <= now.getTime()) return null;
    return record;
  } catch {
    return null;
  }
}

export function signSession(secret: string, now: Date, subject?: string): string {
  return seal(secret, { kind: "teacher", exp: now.getTime() + SESSION_HOURS * 60 * 60 * 1000, ...(subject ? { sub: subject } : {}) });
}

export function verifySession(secret: string, token: string | undefined, now: Date): boolean {
  return unseal(secret, token, now)?.kind === "teacher";
}

/** 有効な Cookie にある印。印の無い古い Cookie と、無効な Cookie は undefined */
export function sessionSubject(secret: string, token: string | undefined, now: Date): string | undefined {
  const payload = unseal(secret, token, now);
  return payload?.kind === "teacher" && typeof payload.sub === "string" ? payload.sub : undefined;
}

export function signLoginState(secret: string, now: Date, login: LoginState): string {
  return seal(secret, { kind: "oidc", ...login, exp: now.getTime() + LOGIN_STATE_MINUTES * 60 * 1000 });
}

/** ログインの途中の Cookie から state・nonce・verifier を取り出す。先生の Cookie や無効な Cookie は undefined */
export function readLoginState(secret: string, token: string | undefined, now: Date): LoginState | undefined {
  const payload = unseal(secret, token, now);
  if (payload?.kind !== "oidc") return undefined;
  const { state, nonce, verifier } = payload;
  return typeof state === "string" && typeof nonce === "string" && typeof verifier === "string" ? { state, nonce, verifier } : undefined;
}
