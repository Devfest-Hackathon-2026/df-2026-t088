// 先生の管理（SCR-T12、#351）。メールアドレスごとの役割（管理者・先生）を、管理者が足し外しする。
// ログインが off のときと、管理者でないときは、一覧を出さずに理由だけを書く。上の並び（TeacherNav）には、まだ入れない（別の変更）。
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ADMIN_COPY, MEMBERS_COPY, PROBLEM_COPY, TODAY_COPY } from "./copy";
import { AdminApiError, listTeacherMembers, readTeacherMe, removeTeacherMember, saveTeacherMember, type MemberRole, type TeacherMember } from "./api";
import "./AdminPages.css";

type State =
  | { status: "loading" }
  | { status: "off" }
  | { status: "login-needed" }
  | { status: "not-admin" }
  | { status: "error" }
  | { status: "ready"; members: TeacherMember[]; self: string };

const roleName = (role: MemberRole) => (role === "admin" ? MEMBERS_COPY.admin : MEMBERS_COPY.teacher);
const errorCode = (error: unknown) => (error instanceof AdminApiError ? error.code : "NETWORK");

/** 操作が断られた理由を、押した場所の近くに出す文にする */
function failureText(error: unknown): string {
  const code = errorCode(error);
  if (code === "ADULT_INVALID_REQUEST" && error instanceof AdminApiError) {
    const reason = error.details.find((detail) => detail.field === "email")?.reason;
    return reason === "domain" ? MEMBERS_COPY.emailDomain : MEMBERS_COPY.emailFormat;
  }
  if (code === "LAST_ADMIN") return MEMBERS_COPY.lastAdmin;
  if (code === "SELF_REMOVAL") return MEMBERS_COPY.selfRemoval;
  if (code === "MEMBER_NOT_FOUND") return MEMBERS_COPY.notFound;
  if (code === "LOGIN_REQUIRED") return ADMIN_COPY.loginRequired;
  if (code === "SCOPE_NOT_ALLOWED") return MEMBERS_COPY.notAdmin;
  return MEMBERS_COPY.failed;
}

export function MembersPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("teacher");
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await readTeacherMe();
      if (!me.enabled) return setState({ status: "off" });
      if (!me.signedIn) return setState({ status: "login-needed" });
      if (me.role !== "admin") return setState({ status: "not-admin" });
      const list = await listTeacherMembers();
      setState({ status: "ready", members: list.members, self: list.self });
    } catch (error) {
      const code = errorCode(error);
      // 一覧を読む前に管理者でなくなった（外された）ときも、理由を出す
      if (code === "SCOPE_NOT_ALLOWED") setState({ status: "not-admin" });
      else if (code === "LOGIN_REQUIRED") setState({ status: "login-needed" });
      else setState((current) => (current.status === "ready" ? current : { status: "error" }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (member: TeacherMember, done: (saved: TeacherMember) => string) => {
    setNotice("");
    setProblem("");
    try {
      const saved = await saveTeacherMember(member);
      setNotice(done(saved.member));
      await load();
      return true;
    } catch (error) {
      setProblem(failureText(error));
      return false;
    }
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await submit({ email, role }, (saved) => MEMBERS_COPY.added(saved.email, roleName(saved.role)));
    if (ok) setEmail("");
  };

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target) return;
    setNotice("");
    setProblem("");
    try {
      await removeTeacherMember(target);
      setNotice(MEMBERS_COPY.removed(target));
      await load();
    } catch (error) {
      setProblem(failureText(error));
    }
  };

  return (
    <main className="admin-page members-page">
      <div className="members-page__head">
        <h1>{MEMBERS_COPY.title}</h1>
        <a href="?">{PROBLEM_COPY.back}</a>
      </div>

      {state.status === "loading" && <p role="status">{TODAY_COPY.loading}</p>}
      {state.status === "off" && <p role="status">{MEMBERS_COPY.off}</p>}
      {state.status === "login-needed" && <p role="alert" className="admin-page__error">{ADMIN_COPY.loginRequired}</p>}
      {state.status === "not-admin" && <p role="alert" className="admin-page__error">{MEMBERS_COPY.notAdmin}</p>}
      {state.status === "error" && <p role="alert" className="admin-page__error">{TODAY_COPY.connError}</p>}

      {state.status === "ready" && (
        <>
          <p className="admin-form__note">{MEMBERS_COPY.intro}</p>
          <form className="members-page__add" onSubmit={(event) => void onAdd(event)} aria-label={MEMBERS_COPY.addTitle}>
            <label htmlFor="member-email">{MEMBERS_COPY.emailLabel}</label>
            <input id="member-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <label htmlFor="member-role">{MEMBERS_COPY.colRole}</label>
            <select id="member-role" value={role} onChange={(event) => setRole(event.target.value as MemberRole)}>
              <option value="teacher">{MEMBERS_COPY.teacher}</option>
              <option value="admin">{MEMBERS_COPY.admin}</option>
            </select>
            <button type="submit" className="admin-page__primary">{MEMBERS_COPY.add}</button>
          </form>

          {notice && <p role="status" className="admin-page__notice">{notice}</p>}
          {problem && <p role="alert" className="admin-page__error">{problem}</p>}

          {pendingRemove && (
            <div className="admin-page__confirm" role="group" aria-label={MEMBERS_COPY.remove}>
              <p>{MEMBERS_COPY.confirmRemove(pendingRemove)}</p>
              <div className="admin-page__actions">
                <button type="button" onClick={() => void confirmRemove()}>{MEMBERS_COPY.remove}</button>
                <button type="button" onClick={() => setPendingRemove(null)}>{MEMBERS_COPY.cancel}</button>
              </div>
            </div>
          )}

          <div className="admin-page__scroll members-page__list">
            <table className="admin-page__table">
              <thead>
                <tr>
                  <th scope="col">{MEMBERS_COPY.colEmail}</th>
                  <th scope="col">{MEMBERS_COPY.colRole}</th>
                  <th scope="col">{MEMBERS_COPY.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {state.members.map((member) => {
                  const mine = member.email === state.self;
                  return (
                    <tr key={member.email} data-member={member.email}>
                      <th scope="row">{member.email}</th>
                      <td>
                        {roleName(member.role)}
                        {mine && <span className="admin-form__note"> （{MEMBERS_COPY.self}）</span>}
                      </td>
                      <td>
                        {!mine && (
                          <div className="admin-page__actions">
                            <button
                              type="button"
                              onClick={() =>
                                void submit({ email: member.email, role: member.role === "admin" ? "teacher" : "admin" }, (saved) =>
                                  MEMBERS_COPY.changed(saved.email, roleName(saved.role)),
                                )
                              }
                            >
                              {member.role === "admin" ? MEMBERS_COPY.makeTeacher : MEMBERS_COPY.makeAdmin}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNotice("");
                                setProblem("");
                                setPendingRemove(member.email);
                              }}
                            >
                              {MEMBERS_COPY.remove}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
