import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LOGIN_COPY } from "./copy";
import { TeacherSessionContext, createGuestWorkspace, GuestWorkspaceError, parseWorkspace, type Workspace } from "./workspace";
import { TeacherAdminContext } from "./use-teacher-admin";
import "./AdminPages.css";

const base = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

type Login = { status: "checking" } | { status: "open" } | { status: "signed-in" } | { status: "login-needed"; signupOpen: boolean; guest: boolean } | { status: "unknown" };

// 先生のログインが on のときだけ、ログインの案内を出す。取れて off（既定）ならそのまま画面を出す。
// 取れなかったとき（通信の失敗・200 以外・形が違う）は画面を出さず、やり直しを出す（D-208）
export function TeacherGate({ children }: { children: ReactNode }) {
  const [login, setLogin] = useState<Login>({ status: "checking" });
  const failed = new URLSearchParams(window.location.search).get("login") === "failed";

  const [attempt, setAttempt] = useState(0);
  // 入っているときの学級。名前を直したら上の並びがここを書き換える
  const [workspace, setWorkspace] = useState<Workspace | undefined>(undefined);
  // ログインなしで作ったお試しの学級か（me の signup が guest）
  const [guest, setGuest] = useState(false);
  const sessionValue = useMemo(() => ({ session: { workspace, guest }, setWorkspace }), [workspace, guest]);
  // 管理者として入っているか。上の並びの「先生の管理」に渡す（D-209）
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${base}/api/v1/teacher/me`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { enabled?: unknown; signedIn?: unknown; signup?: unknown; workspace?: unknown; role?: unknown } | null) => {
        if (!alive) return;
        setAdmin(body?.enabled === true && body.signedIn === true && body.role === "admin");
        if (!body || typeof body !== "object" || typeof body.enabled !== "boolean") setLogin({ status: "unknown" });
        else if (body.enabled && !body.signedIn) setLogin({ status: "login-needed", signupOpen: body.signup === "open", guest: body.signup === "guest" });
        else {
          setGuest(body.enabled === true && body.signup === "guest");
          setWorkspace(body.enabled ? parseWorkspace(body.workspace) : undefined);
          setLogin({ status: body.enabled ? "signed-in" : "open" });
        }
      })
      .catch(() => {
        if (alive) setLogin({ status: "unknown" });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = () => {
    setLogin({ status: "checking" });
    setAttempt((n) => n + 1);
  };

  if (login.status === "checking") return null;
  if (login.status === "unknown") {
    return (
      <main className="teacher-today">
        <p role="alert">{LOGIN_COPY.unknown}</p>
        <p>
          <button type="button" onClick={retry}>
            {LOGIN_COPY.retry}
          </button>
        </p>
      </main>
    );
  }
  if (login.status !== "login-needed") {
    return (
      <TeacherAdminContext.Provider value={admin}>
        <TeacherSessionContext.Provider value={sessionValue}>{children}</TeacherSessionContext.Provider>
      </TeacherAdminContext.Provider>
    );
  }

  if (login.guest) return <GuestEntry />;

  return (
    <main className="admin-page teacher-gate">
      <section className="teacher-gate__card">
        <h1>{LOGIN_COPY.heading}</h1>
        <p>{login.signupOpen ? LOGIN_COPY.signupOpen : LOGIN_COPY.intro}</p>
        {failed && <p className="teacher-gate__failed" role="alert">{LOGIN_COPY.failed}</p>}
        <a className="admin-page__button admin-page__primary teacher-gate__login" href={`${base}/api/v1/teacher/login`}>
          {LOGIN_COPY.button}
        </a>
      </section>
    </main>
  );
}

// ログインなしで学級をつくる入口。押すとサーバーが学級と Cookie を用意するので、再読み込みで先生の画面に入る
function GuestEntry() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function start() {
    setBusy(true);
    setProblem("");
    try {
      await createGuestWorkspace();
      window.location.reload();
    } catch (error) {
      // 429 などは、サーバーの文をそのまま出す
      setProblem(error instanceof GuestWorkspaceError && error.message !== "" ? error.message : LOGIN_COPY.guestFailed);
      setBusy(false);
    }
  }

  return (
    <main className="admin-page teacher-gate">
      <section className="teacher-gate__card">
        <h1>{LOGIN_COPY.guestHeading}</h1>
        <p>{LOGIN_COPY.guestIntro}</p>
        {problem && <p className="teacher-gate__failed" role="alert">{problem}</p>}
        <button type="button" className="admin-page__button admin-page__primary teacher-gate__login" disabled={busy} onClick={() => void start()}>
          {LOGIN_COPY.guestButton}
        </button>
      </section>
    </main>
  );
}
