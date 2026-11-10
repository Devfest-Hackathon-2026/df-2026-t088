// 先生のログインの設定を、環境変数から読む。TEACHER_LOGIN=on か guest のときだけ、ログインを要求する（既定は今のまま）。
// 足りない設定は起動時に止める（名前だけを出し、値は出さない）。
import { randomBytes } from "node:crypto";
import { MIN_SECRET_LENGTH } from "./session.ts";
import type { OidcConfig } from "./oidc.ts";
import { MemoryTeacherMemberStore, normalizeEmail, type Member, type TeacherMemberStore } from "../teacher-members/store.ts";
import { createWorkspaceStoreFromEnv } from "../workspace/firestore-store.ts";
import { createMemoryWorkspaceStore, readReadsPerDay, type WorkspaceStore } from "../workspace/store.ts";

// open は、名簿に無い Google アカウントも先生として入れ、学級を作る（TEACHER_SIGNUP=open）。roster は名簿にいる人だけ
// guest は、Google を使わず「お試しの学級をつくる」ボタンだけで学級ができる（TEACHER_LOGIN=guest。公開デモ用）
export type TeacherSignup = "open" | "roster" | "guest";

// guest で SESSION_SECRET が無いときの鍵の長さ（バイト）。学級がメモリにあるので、再起動で学級と一緒に消えてよい
const GUEST_SECRET_BYTES = 48;

export type TeacherLoginSettings =
  | { enabled: false }
  // allowed は TEACHER_EMAILS の初めの値。ログインの判定は、いまの名簿（members。管理者が画面から変えられる）で決まる（#351）
  // origin は PUBLIC_BASE_URL の origin。Cookie 付きの書き込みの Origin 検査に使う
  // oidc は Google のログインの設定。guest のときは無い
  | { enabled: true; oidc?: OidcConfig; sessionSecret: string; allowed: Set<string>; members: TeacherMemberStore; home: string; secure: boolean; signup: TeacherSignup; workspaces: WorkspaceStore; origin: string };

const emailsOf = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.length > 0);

export function readTeacherLogin(env: NodeJS.ProcessEnv, firestoreFetcher?: typeof fetch): TeacherLoginSettings {
  if (env.TEACHER_LOGIN !== "on" && env.TEACHER_LOGIN !== "guest") return { enabled: false };
  const guest = env.TEACHER_LOGIN === "guest";

  // guest は Google の設定も名簿も要らない。秘密の鍵も任意（無ければ起動のたびに作る）
  const required = guest ? ["PUBLIC_BASE_URL"] : ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "PUBLIC_BASE_URL", "SESSION_SECRET"];
  const missing = required.filter((name) => !env[name]?.trim());
  const signup: TeacherSignup = guest ? "guest" : env.TEACHER_SIGNUP?.trim() === "open" ? "open" : "roster";
  // open のときは名簿が空でも起動できる（だれでも入れるため）
  if (signup === "roster" && emailsOf(env.ADMIN_EMAILS).length === 0 && emailsOf(env.TEACHER_EMAILS).length === 0) missing.push("ADMIN_EMAILS or TEACHER_EMAILS");
  if (missing.length > 0) throw new Error(`TEACHER_LOGIN=${guest ? "guest" : "on"} needs: ${missing.join(", ")}`);

  const base = env.PUBLIC_BASE_URL!.trim().replace(/\/+$/, "");
  const secure = base.startsWith("https://");
  if (!secure && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("PUBLIC_BASE_URL must be https (or localhost for development)");

  const given = env.SESSION_SECRET?.trim() ?? "";
  // 鍵を作るのは guest で無いときだけ。作った鍵は出さない
  const secret = guest && given === "" ? randomBytes(GUEST_SECRET_BYTES).toString("base64url") : given;
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);

  // guest の名簿は空（ADMIN_EMAILS・TEACHER_EMAILS は読まない）。名簿の先生だけの操作は、guest の人には通らない
  const allowed = new Set(guest ? [] : emailsOf(env.TEACHER_EMAILS));
  // 最初の管理者は環境変数でしか作れない。同じメールが両方にあれば管理者
  const initial: Member[] = guest ? [] : [
    ...emailsOf(env.TEACHER_EMAILS).map((email) => ({ email, role: "teacher" as const })),
    ...emailsOf(env.ADMIN_EMAILS).map((email) => ({ email, role: "admin" as const })),
  ];

  return {
    enabled: true,
    ...(guest ? {} : {
      oidc: {
        clientId: env.GOOGLE_CLIENT_ID!.trim(),
        clientSecret: env.GOOGLE_CLIENT_SECRET!.trim(),
        redirectUri: `${base}/api/v1/teacher/callback`,
        schoolDomain: env.SCHOOL_DOMAIN?.trim() || undefined,
      },
    }),
    sessionSecret: secret,
    allowed,
    members: new MemoryTeacherMemberStore(initial),
    home: env.TEACHER_HOME?.trim() || "/teacher/",
    secure,
    signup,
    // guest の学級は必ずメモリだけ。鍵が起動ごとに変わるので、Firestore に残すと誰も入れない孤児が貯まる
    workspaces: guest ? createMemoryWorkspaceStore({ readsPerDay: readReadsPerDay(env) }) : createWorkspaceStoreFromEnv(env, firestoreFetcher),
    origin: new URL(base).origin,
  };
}
