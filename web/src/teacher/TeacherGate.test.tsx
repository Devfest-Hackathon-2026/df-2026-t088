import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherGate } from "./TeacherGate";
import { LOGIN_COPY } from "./copy";
import { useTeacherSession } from "./workspace";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

function stubMe(reply: () => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (input: string) => {
    if (String(input).endsWith("/api/v1/teacher/me")) return reply();
    return new Response("{}", { status: 404 });
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/teacher/");
});
afterEach(() => vi.unstubAllGlobals());

describe("TeacherGate（先生のログイン）", () => {
  it("ログインが on で、まだログインしていないときは、ログインの案内を出し、中身は出さない", async () => {
    stubMe(() => json({ enabled: true, signedIn: false }));
    render(
      <TeacherGate>
        <p>中身</p>
      </TeacherGate>,
    );
    const link = await screen.findByRole("link", { name: LOGIN_COPY.button });
    expect(link.getAttribute("href")).toMatch(/\/api\/v1\/teacher\/login$/);
    expect(screen.queryByText("中身")).toBeNull();
  });

  it("ログイン済みなら、中身を出す", async () => {
    stubMe(() => json({ enabled: true, signedIn: true }));
    render(
      <TeacherGate>
        <p>中身</p>
      </TeacherGate>,
    );
    expect(await screen.findByText("中身")).toBeTruthy();
  });

  it("ログインが off（既定）なら、そのまま中身を出す", async () => {
    stubMe(() => json({ enabled: false, signedIn: false }));
    render(
      <TeacherGate>
        <p>中身</p>
      </TeacherGate>,
    );
    expect(await screen.findByText("中身")).toBeTruthy();
  });

  const gated = () =>
    render(
      <TeacherGate>
        <p>中身</p>
      </TeacherGate>,
    );

  it.each([
    ["サーバーにつながらない", () => { throw new TypeError("network down"); }],
    ["500", () => new Response("{}", { status: 500 })],
    ["壊れた JSON", () => new Response("not json", { status: 200 })],
    ["形が違う", () => json({ hello: 1 })],
  ])("確かめられないとき（%s）は、中身を出さず、やり直しを出す", async (_name, reply) => {
    stubMe(reply as () => Response);
    gated();
    expect(await screen.findByText(LOGIN_COPY.unknown)).toBeTruthy();
    expect(screen.getByRole("button", { name: LOGIN_COPY.retry })).toBeTruthy();
    expect(screen.queryByText("中身")).toBeNull();
  });

  it("やり直すで取り直せて、ログインが off なら中身を出す", async () => {
    let calls = 0;
    stubMe(() => {
      calls += 1;
      if (calls === 1) throw new TypeError("network down");
      return json({ enabled: false, signedIn: false });
    });
    gated();
    fireEvent.click(await screen.findByRole("button", { name: LOGIN_COPY.retry }));
    expect(await screen.findByText("中身")).toBeTruthy();
    expect(screen.queryByText(LOGIN_COPY.unknown)).toBeNull();
    expect(calls).toBe(2);
  });

  it("ログインに失敗して戻ったときは、失敗の文を出す", async () => {
    window.history.replaceState(null, "", "/teacher/?login=failed");
    stubMe(() => json({ enabled: true, signedIn: false }));
    render(
      <TeacherGate>
        <p>中身</p>
      </TeacherGate>,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(LOGIN_COPY.failed)).toBeTruthy();
  });

  it("signup が open のときは、入口に学級ができる案内を出す", async () => {
    stubMe(() => json({ enabled: true, signedIn: false, signup: "open" }));
    gated();
    expect(await screen.findByText(LOGIN_COPY.signupOpen)).toBeTruthy();
    expect(LOGIN_COPY.signupOpen).toBe("Google アカウントで入ると、自分の学級ができます。審査・お試しの方も、ここから入れます。");
    expect(screen.queryByText(LOGIN_COPY.intro)).toBeNull();
  });

  it("signup が roster（名簿だけ）のときは、案内を出さない", async () => {
    stubMe(() => json({ enabled: true, signedIn: false, signup: "roster" }));
    gated();
    await screen.findByRole("link", { name: LOGIN_COPY.button });
    expect(screen.queryByText(LOGIN_COPY.signupOpen)).toBeNull();
    expect(screen.getByText(LOGIN_COPY.intro)).toBeTruthy();
  });

  describe("signup が guest（ログインなしで学級ができる）のとき", () => {
    const stubGuest = (guestReply: () => Response | Promise<Response>) => {
      const guestCalls: RequestInit[] = [];
      vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
        if (String(input).endsWith("/api/v1/teacher/me")) return json({ enabled: true, signedIn: false, signup: "guest" });
        if (String(input).endsWith("/api/v1/teacher/guest")) {
          guestCalls.push(init ?? {});
          return guestReply();
        }
        return new Response("{}", { status: 404 });
      });
      return guestCalls;
    };

    it("入口の文とボタンを出し、Google のリンクと中身は出さない", async () => {
      stubGuest(() => json({}));
      gated();
      expect(await screen.findByRole("heading", { name: "先生の画面" })).toBeTruthy();
      expect(screen.getByText("お試しの学級をつくると、プリントを撮って配るところまで、そのまま試せます。ログインは要りません。")).toBeTruthy();
      expect(screen.getByRole("button", { name: "お試しの学級をつくる" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: LOGIN_COPY.button })).toBeNull();
      expect(screen.queryByText("中身")).toBeNull();
    });

    it("押すと POST /api/v1/teacher/guest を送り、成功したら再読み込みする", async () => {
      const calls = stubGuest(() => json({ workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }));
      const reload = vi.fn();
      vi.stubGlobal("location", { ...window.location, reload });
      gated();
      fireEvent.click(await screen.findByRole("button", { name: "お試しの学級をつくる" }));
      await waitFor(() => expect(reload).toHaveBeenCalled());
      expect(calls).toHaveLength(1);
      expect(calls[0]?.method).toBe("POST");
    });

    it("失敗したら、サーバーの文をそのまま出し、もう一度押せる", async () => {
      const message = "少し休んでから、もういちど押してね";
      stubGuest(() => new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message } }), { status: 429 }));
      const reload = vi.fn();
      vi.stubGlobal("location", { ...window.location, reload });
      gated();
      fireEvent.click(await screen.findByRole("button", { name: "お試しの学級をつくる" }));
      expect((await screen.findByRole("alert")).textContent).toBe(message);
      expect(reload).not.toHaveBeenCalled();
      expect((screen.getByRole("button", { name: "お試しの学級をつくる" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("文が読めない失敗・通信の失敗は、既定の文を出して落ちない", async () => {
      stubGuest(() => new Response("oops", { status: 500 }));
      gated();
      fireEvent.click(await screen.findByRole("button", { name: "お試しの学級をつくる" }));
      expect((await screen.findByRole("alert")).textContent).toBe(LOGIN_COPY.guestFailed);
      vi.stubGlobal("fetch", async (input: string) => {
        if (String(input).endsWith("/teacher/me")) return json({ enabled: true, signedIn: false, signup: "guest" });
        throw new TypeError("network down");
      });
      fireEvent.click(screen.getByRole("button", { name: "お試しの学級をつくる" }));
      await waitFor(() => expect((screen.getByRole("button", { name: "お試しの学級をつくる" }) as HTMLButtonElement).disabled).toBe(false));
      expect(screen.getByRole("alert").textContent).toBe(LOGIN_COPY.guestFailed);
    });

    it("入っているときは、guest であることを中身へ渡す", async () => {
      stubMe(() => json({ enabled: true, signedIn: true, signup: "guest", workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }));
      render(<TeacherGate><GuestProbe /></TeacherGate>);
      expect(await screen.findByText("guest")).toBeTruthy();
    });
  });

  const GuestProbe = () => <p>{useTeacherSession().session.guest ? "guest" : "not guest"}</p>;

  const Probe = () => {
    const { workspace } = useTeacherSession().session;
    return <p>{workspace ? `${workspace.name}/${workspace.joinCode}` : "学級なし"}</p>;
  };

  it("入っているときは、読んだ学級を中身へ渡す", async () => {
    stubMe(() => json({ enabled: true, signedIn: true, signup: "open", workspace: { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" } }));
    render(<TeacherGate><Probe /></TeacherGate>);
    expect(await screen.findByText("わたしの学級/AB23CD")).toBeTruthy();
  });

  it("ログインが off のときは、学級を渡さない", async () => {
    stubMe(() => json({ enabled: false, signedIn: false, workspace: { id: "w-1", name: "x", joinCode: "AB23CD" } }));
    render(<TeacherGate><Probe /></TeacherGate>);
    expect(await screen.findByText("学級なし")).toBeTruthy();
  });
});
