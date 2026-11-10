import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeacherNav } from "./TeacherNav";
import { getApproverKey, setApproverKey } from "./approver-key";
import { TeacherGate } from "./TeacherGate";
import { TeacherSessionContext, type Workspace } from "./workspace";

const meJson = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const stubMe = (reply: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(reply));

afterEach(() => {
  setApproverKey("");
  vi.unstubAllGlobals();
});

const WORKSPACE: Workspace = { id: "w-1", name: "わたしの学級", joinCode: "AB23CD" };

// TeacherGate と同じく、学級を持ち、直したら差し替える
function InWorkspace() {
  const [workspace, setWorkspace] = useState(WORKSPACE);
  return <TeacherSessionContext.Provider value={{ session: { workspace }, setWorkspace }}><TeacherNav current="class" /></TeacherSessionContext.Provider>;
}

describe("TeacherNav の承認キーの欄", () => {
  it("上の並びの行に欄が出て、入れた値が getApproverKey() で読める", () => {
    const { container } = render(<TeacherNav current="class" />);
    const input = screen.getByLabelText("承認キー") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(container.querySelector(".teacher-nav-row")?.contains(input)).toBe(true);
    // ナビのランドマークの中には入れない
    expect(within(screen.getByRole("navigation")).queryByLabelText("承認キー")).toBeNull();
    fireEvent.change(input, { target: { value: "k1" } });
    expect(getApproverKey()).toBe("k1");
  });

  it("説明の文は title と、aria-describedby で結んだ補足に入る", () => {
    render(<TeacherNav current="class" />);
    const input = screen.getByLabelText("承認キー") as HTMLInputElement;
    expect(input.title).toContain("この画面を閉じると消えます。");
    expect(document.getElementById(input.getAttribute("aria-describedby") ?? "")?.textContent).toBe(input.title);
  });
});

describe("TeacherNav（学級に入っているとき）", () => {
  it("学級の名前・コード・子ども用のリンクを出し、承認キーの欄は出さない", () => {
    render(<InWorkspace />);
    expect((screen.getByLabelText("学級の名前") as HTMLInputElement).value).toBe("わたしの学級");
    expect(screen.getByText("AB23CD")).toBeTruthy();
    expect((screen.getByLabelText("子ども用のリンク") as HTMLInputElement).value).toBe(`${window.location.origin}/join/AB23CD`);
    expect(screen.getByRole("button", { name: "コピーする" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
    expect(screen.queryByLabelText("承認キー")).toBeNull();
  });

  it("入っていないときは、今のまま承認キーの欄を出す", () => {
    render(<TeacherNav current="class" />);
    expect(screen.getByLabelText("承認キー")).toBeTruthy();
    expect(screen.queryByLabelText("学級の名前")).toBeNull();
  });

  it("「子どもが 自分で 撮ってよい」は既定で外れていて、注意の文が付く。押すと childCapture だけを PATCH で送り、返った値に差し替える", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...WORKSPACE, childCapture: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InWorkspace />);
    const box = screen.getByLabelText("子どもが 自分で 撮ってよい") as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toContain("読めるのは、てこと月の問題だけです");
    fireEvent.click(box);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/workspace");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ childCapture: true });
    await waitFor(() => expect((screen.getByLabelText("子どもが 自分で 撮ってよい") as HTMLInputElement).checked).toBe(true));
  });

  it("切り替えに失敗したら、チェックは変えず、やさしい文を出す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<InWorkspace />);
    fireEvent.click(screen.getByLabelText("子どもが 自分で 撮ってよい"));
    expect((await screen.findByRole("alert")).textContent).toContain("切り替えられませんでした");
    expect((screen.getByLabelText("子どもが 自分で 撮ってよい") as HTMLInputElement).checked).toBe(false);
  });

  it("名前を直すと PATCH /api/v1/workspace を送り、返った名前に差し替える", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...WORKSPACE, name: "5年1組" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<InWorkspace />);
    const input = screen.getByLabelText("学級の名前") as HTMLInputElement;
    fireEvent.change(input, { target: { value: " 5年1組 " } });
    fireEvent.blur(input);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/workspace$/);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: "5年1組" });
    await waitFor(() => expect((screen.getByLabelText("学級の名前") as HTMLInputElement).value).toBe("5年1組"));
  });

  it("名前を直せなかったときは、元の名前に戻して知らせる", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    render(<InWorkspace />);
    const input = screen.getByLabelText("学級の名前") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "あたらしい名前" } });
    fireEvent.blur(input);
    expect((await screen.findByRole("alert")).textContent).toContain("名前を直せませんでした");
    expect(input.value).toBe("わたしの学級");
  });

  it("コピーするで、子ども用のリンクをクリップボードへ送る", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<InWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "コピーする" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/AB23CD`));
    expect(await screen.findByRole("button", { name: "コピーしました" })).toBeTruthy();
  });

  it("ログアウトは POST /api/v1/teacher/logout を送る", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<InWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/teacher\/logout$/);
    expect(init.method).toBe("POST");
    // 本文の無い POST は、サーバが 415 で断る（#532）。JSON として空の本文を送る
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(init.body).toBe("{}");
  });

  it("ログアウトが断られたら、読み直さずに知らせる", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 415 })));
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    render(<InWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect((await screen.findByRole("alert")).textContent).toContain("ログアウトできませんでした");
    expect(reload).not.toHaveBeenCalled();
  });

  // TeacherGate が me の signup から渡すのと同じ形で、お試しの学級として入る
  const inGuestWorkspace = () =>
    render(<TeacherSessionContext.Provider value={{ session: { workspace: WORKSPACE, guest: true }, setWorkspace: () => {} }}><TeacherNav current="class" /></TeacherSessionContext.Provider>);

  it("お試しの学級では「学級をとじる」になり、確かめてからログアウトを送る。やめれば送らない", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    inGuestWorkspace();
    expect(screen.queryByRole("button", { name: "ログアウト" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "学級をとじる" }));
    expect(confirm).toHaveBeenCalledWith("この学級と、配った説明は 開けなくなります。とじますか？");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "学級をとじる" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/teacher\/logout$/);
    expect(init.method).toBe("POST");
  });

  it("Google で入った学級では、今のまま「ログアウト」で、確かめを出さない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    render(<InWorkspace />);
    expect(screen.queryByRole("button", { name: "学級をとじる" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("TeacherNav の承認キーは審査・デモ用だと分かる（D-209）", () => {
  it("欄の薄い文字と説明の頭に「審査・デモ用」が出る", () => {
    render(<TeacherNav current="class" />);
    const input = screen.getByLabelText("承認キー") as HTMLInputElement;
    expect(input.placeholder).toBe("審査・デモ用");
    expect(input.title.startsWith("審査・デモ用の入口です。")).toBe(true);
  });
});

describe("TeacherNav の「先生の管理」（D-209。TeacherGate が取った me を Context で受ける）", () => {
  it("Gate の外（Context の既定）では出ず、fetch もしない", () => {
    stubMe(meJson({ enabled: true, signedIn: true, role: "admin" }));
    render(<TeacherNav current="class" />);
    expect(screen.queryByRole("link", { name: "先生の管理" })).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("Gate の下で管理者として入っている時だけ出て、?view=members へ行く。me の読み出しは Gate の 1 回だけ", async () => {
    stubMe(meJson({ enabled: true, signedIn: true, role: "admin" }));
    render(
      <TeacherGate>
        <TeacherNav current="class" />
      </TeacherGate>,
    );
    const link = await screen.findByRole("link", { name: "先生の管理" });
    expect(link.getAttribute("href")).toBe("?view=members");
    expect(within(screen.getByRole("navigation", { name: "先生の管理" })).getByRole("link", { name: "先生の管理" })).toBe(link);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["先生", { enabled: true, signedIn: true, role: "teacher" }],
    ["ログイン off", { enabled: false, signedIn: false }],
    ["承認キーだけ（役割なし）", { enabled: true, signedIn: true }],
    ["off なのに role が admin", { enabled: false, signedIn: false, role: "admin" }],
  ])("%s の時は出ない", async (_name, body) => {
    stubMe(meJson(body));
    render(
      <TeacherGate>
        <TeacherNav current="class" />
      </TeacherGate>,
    );
    await screen.findByRole("navigation");
    expect(screen.queryByRole("link", { name: "先生の管理" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "出題順を変える" }).getAttribute("href")).toBe("?view=problem-order");
    expect(screen.getByRole("link", { name: "教材をつくる" }).getAttribute("href")).toBe("?view=studio");
  });
});
