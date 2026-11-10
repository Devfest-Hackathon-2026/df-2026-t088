// 先生の役割の管理の API（#351）。決まりの正本は docs/product/education-api-contract.md「先生の役割の管理の API」。
// 3 つとも、TEACHER_LOGIN=on で、管理者としてログインしているときだけ通す。承認キーでは通さない（キーは審査・デモ用）。
// 順番は、ログイン（401）→ 管理者か（403）→ 入力の検査（400）→ 名簿の決まり（404・409）。
import type { Context, Hono } from "hono";
import type { ApiErrorCode } from "../api-types.ts";
import { apiFailure } from "../errors.ts";
import { teacherMemberOf, teacherSessionValid } from "../teacher-login/routes.ts";
import type { TeacherLoginSettings } from "../teacher-login/config.ts";
import { normalizeEmail, type Member, type MemberRole, type TeacherMemberStore } from "./store.ts";

type Detail = { field: string; reason: string };

const EMAIL_MAX = 254;
// local@domain.tld の形だけを見る（空白と @ の重なりを断る）。本当にその人のものかは、Google のログインが確かめる
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

function fail(context: Context, code: ApiErrorCode, details?: Detail[]): Response {
  const failure = apiFailure(code, details);
  return context.json(failure.body, failure.status as 400);
}

async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

/** 受ける値の検査。email は小文字にして返す。SCHOOL_DOMAIN があれば、その @ の後ろだけ */
function checkMember(body: unknown, schoolDomain: string | undefined): { ok: true; value: Member } | { ok: false; details: Detail[] } {
  const record = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const details: Detail[] = [];
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : "";
  if (email.length === 0 || email.length > EMAIL_MAX || !EMAIL_SHAPE.test(email)) {
    details.push({ field: "email", reason: "format" });
  } else if (schoolDomain && !email.endsWith(`@${schoolDomain.trim().toLowerCase()}`)) {
    details.push({ field: "email", reason: "domain" });
  }
  const role = record.role;
  if (role !== "admin" && role !== "teacher") details.push({ field: "role", reason: "role" });
  if (details.length > 0) return { ok: false, details };
  return { ok: true, value: { email, role: role as MemberRole } };
}

type Gate = { self: Member; members: TeacherMemberStore; schoolDomain: string | undefined } | { refused: Response };

export function registerTeacherMemberRoutes<Env extends object>(app: Hono<Env>, settings: TeacherLoginSettings): void {
  /** 管理者としてのログインを確かめる。通れば自分の行と名簿、通らなければ返す応答 */
  const requireAdmin = (context: Context): Gate => {
    if (!settings.enabled || !teacherSessionValid(settings, context)) return { refused: fail(context, "LOGIN_REQUIRED") };
    const self = teacherMemberOf(settings, context);
    if (!self || self.role !== "admin") return { refused: fail(context, "SCOPE_NOT_ALLOWED") };
    return { self, members: settings.members, schoolDomain: settings.oidc?.schoolDomain };
  };

  app.get("/api/v1/teacher/members", (context) => {
    const gate = requireAdmin(context);
    if ("refused" in gate) return gate.refused;
    return context.json({ members: gate.members.list(), self: gate.self.email });
  });

  app.post("/api/v1/teacher/members", async (context) => {
    const gate = requireAdmin(context);
    if ("refused" in gate) return gate.refused;
    const checked = checkMember(await readJson(context), gate.schoolDomain);
    if (!checked.ok) return fail(context, "ADULT_INVALID_REQUEST", checked.details);
    const result = await gate.members.set(checked.value.email, checked.value.role);
    if (result === "last-admin") return fail(context, "LAST_ADMIN");
    return context.json({ member: checked.value }, result === "added" ? 201 : 200);
  });

  app.delete("/api/v1/teacher/members/:email", async (context) => {
    const gate = requireAdmin(context);
    if ("refused" in gate) return gate.refused;
    const email = normalizeEmail(context.req.param("email") ?? "");
    if (email === gate.self.email) return fail(context, "SELF_REMOVAL");
    const result = await gate.members.remove(email);
    if (result === "not-found") return fail(context, "MEMBER_NOT_FOUND");
    if (result === "last-admin") return fail(context, "LAST_ADMIN");
    return context.json({ email });
  });
}
