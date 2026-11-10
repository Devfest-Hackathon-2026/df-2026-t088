import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchPage } from "./ResearchPage";
import { setApproverKey } from "../teacher/approver-key";

type Reply = { status: number; json: unknown };
type Call = { method: string; path: string; search: string; body: Record<string, unknown> | undefined; headers: Record<string, string> };

let calls: Call[] = [];
let routes: Record<string, (call: Call) => Reply> = {};

const ok = (json: unknown): Reply => ({ status: 200, json });
const failure = (status: number, code: string, message: string): Reply => ({ status, json: { error: { code, message } } });

beforeEach(() => {
  setApproverKey("");
  calls = [];
  routes = { "GET /api/health": () => ok({ status: "ok" }) };
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const [path = "", search = ""] = String(input).split("?");
    const call: Call = { method: init?.method ?? "GET", path, search, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: { ...(init?.headers as Record<string, string> | undefined) } };
    calls.push(call);
    const reply = routes[`${call.method} ${path}`]?.(call) ?? failure(404, "NOT_FOUND", "未設定の経路です");
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { "content-type": "application/json" } });
  });
});

afterEach(() => vi.unstubAllGlobals());

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const callsTo = (path: string) => calls.filter((call) => call.path === path);
const stepOf = (element: HTMLElement) => element.closest("li") as HTMLElement;

const audit = (items: unknown[] = []) => () => ok({ items });

const suggestionOf = (pattern: string, id = "suggestion-1") => ({
  id, status: "pending", generatedBy: "table", lessonKey: "main-6", problem: "1/3+1/4", pattern,
  candidates: [{ number: 1, source: "table", hint: "共通の単位を先に見せましょう", passed: true }],
  replacesHintIndex: 0, hint: "共通の単位を先に見せましょう", basis: { count: 5 },
});

describe("ResearchPage: 言葉", () => {
  it("教材をつくる入口は大人向けタブだけに置く", () => {
    render(<ResearchPage />);
    expect(screen.getByRole("tab", { name: "教材をつくる" })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: "教材をつくる" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "教材をつくる" }));
    expect(screen.getByRole("tabpanel", { name: "教材をつくる" })).toBeTruthy();
  });

  it("規則で見つけ、AI が下書きし、検査と先生の承認で止めると示す", () => {
    render(<ResearchPage />);
    expect(screen.getByText(/ダミーのデータで動くデモ/)).toBeTruthy();
    expect(screen.getByText(/記録の分布は私たちが作ったもの/)).toBeTruthy();
    expect(screen.getByText(/規則で見つけ、AI が下書きし、機械の検査と先生の承認で止めます/)).toBeTruthy();
  });

  it("見出しは、規則表を AI と呼ばない", () => {
    render(<ResearchPage />);
    expect(screen.queryByText(/AI が直し方/)).toBeNull();
    expect(screen.getByRole("heading", { name: /規則表で型を判定し、直し方の文を下書きする/ })).toBeTruthy();
  });

  it("手順 1 は「押す」ではなく「間違える」で、送る項目を実際のとおりに書く", () => {
    render(<ResearchPage />);
    expect(screen.getByRole("heading", { name: /子どもが問題を間違える/ })).toBeTruthy();
    expect(screen.getByText(/学習の名前、問題、間違い方の種類、ヒントを見た数、日にち/)).toBeTruthy();
    expect(screen.queryByText(/分かんない」を押す/)).toBeNull();
  });

  it("最初に、5 つの流れの一覧を出す", () => {
    render(<ResearchPage />);
    const flow = screen.getByRole("list", { name: "5 つの流れ" });
    expect(within(flow).getAllByRole("listitem")).toHaveLength(5);
  });

  it("役割は自己申告で、本人確認が無いと、先生の手順にも書く", () => {
    render(<ResearchPage />);
    expect(screen.getByText(/本人確認はありません/)).toBeTruthy();
  });

  it("証跡は「どの役割が」と書き、個人は特定できないと示す", () => {
    render(<ResearchPage />);
    expect(screen.getByText(/どの役割が、いつ/)).toBeTruthy();
    expect(screen.queryByText(/誰が、いつ/)).toBeNull();
  });

  it("人の種類ではなく見る段階を選び、段階ごとの範囲を示す", () => {
    render(<ResearchPage />);
    const stageGroup = screen.getByRole("group", { name: "見る段階" });
    const records = within(stageGroup).getByLabelText("クラスの 1 件ずつ");
    expect((records as HTMLInputElement).type).toBe("radio");
    fireEvent.click(records);
    expect((screen.getByLabelText("1 件ずつの記録") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("問題・型・見たヒントの数・日付")).toBeTruthy();
    expect(screen.getByText("名前・番号・時刻・答えの文字")).toBeTruthy();
    expect(screen.getByText("先生", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("server", { selector: "dd" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("問題ごとの件数だけ"));
    expect((within(stageGroup).getByLabelText("教材ごとの集計") as HTMLInputElement).checked).toBe(true);
  });

  it("まだ無い段階も選べて、未実装の案内を出す", () => {
    render(<ResearchPage />);
    const stageGroup = screen.getByRole("group", { name: "見る段階" });
    fireEvent.click(within(stageGroup).getByRole("radio", { name: /自分の分だけ/ }));
    const personalDetail = within(screen.getByRole("region", { name: "自分の分だけ" }));
    expect(personalDetail.getByText("まだ作っていません")).toBeTruthy();
    expect(personalDetail.getByText("自分がよく間違える形")).toBeTruthy();
    expect(personalDetail.getByText("ほかの子の記録")).toBeTruthy();
    fireEvent.click(within(stageGroup).getByRole("radio", { name: /学校をまたぐ集計/ }));
    const schoolDetail = within(screen.getByRole("region", { name: "学校をまたぐ集計" }));
    expect(schoolDetail.getByText("学年や地域で弱い単元")).toBeTruthy();
    expect(schoolDetail.getByText("学校名がわかる小さな集計")).toBeTruthy();
  });

  it("役割で届かない段階には案内を出し、集計段階は研究者にも届く", () => {
    render(<ResearchPage />);
    fireEvent.click(screen.getByLabelText("研究者"));
    const stageGroup = screen.getByRole("group", { name: "見る段階" });
    fireEvent.click(within(stageGroup).getByLabelText("クラスの 1 件ずつ"));
    expect(screen.getByText("この役割では見られません")).toBeTruthy();
    fireEvent.click(within(stageGroup).getByLabelText("教材ごとの集計"));
    expect(screen.queryByText("この役割では見られません")).toBeNull();
    expect(screen.getByText("先生、教材を作る人、研究者")).toBeTruthy();
  });
});

describe("ResearchPage: 動き", () => {
  it("ほかの学校の集計を読み、見本データの表を出す", async () => {
    routes["GET /api/v1/loop/region"] = () => ok({ items: [{ lessonKey: "main-6", problem: "1/3+1/4", pattern: "sum-both", count: 12, source: "dummy" }] });
    render(<ResearchPage />);
    press("ほかの学校の集計を見る");
    const table = await screen.findByRole("table", { name: "ほかの学校では" });
    expect(within(table).getByText("1/3+1/4")).toBeTruthy();
    expect(within(table).getByText("分子どうし、分母どうしを計算した形")).toBeTruthy();
    expect(within(table).getByText("12 件")).toBeTruthy();
    expect(screen.getByText("見本のデータ")).toBeTruthy();
    expect(callsTo("/api/v1/loop/region")).toHaveLength(1);
  });

  it("地域のデータが無いときは表を出さない", async () => {
    routes["GET /api/v1/loop/region"] = () => failure(404, "NOT_FOUND", "データセットがありません");
    render(<ResearchPage />);
    press("ほかの学校の集計を見る");
    await waitFor(() => expect(callsTo("/api/v1/loop/region")).toHaveLength(1));
    expect(screen.queryByRole("table", { name: "ほかの学校では" })).toBeNull();
    expect(screen.queryByText("指定の提案が見つかりません")).toBeNull();
  });

  it("サーバーの状態を出す", async () => {
    render(<ResearchPage />);
    expect(await screen.findByText("サーバーにつながっています")).toBeTruthy();
  });

  it("サーバーにつながらないときは、つながっていないと出す", async () => {
    vi.stubGlobal("fetch", async () => { throw new TypeError("network"); });
    render(<ResearchPage />);
    expect(await screen.findByText(/サーバーにつながっていません/)).toBeTruthy();
  });

  it("間違えた記録は、source が demo で 1 件ずつ送り、数を出す", async () => {
    routes["POST /api/v1/stumbles"] = () => ({ status: 201, json: { received: true } });
    render(<ResearchPage />);
    press("5 件まとめて送る");
    await waitFor(() => expect(screen.getByText("これまでに送った数：5 件")).toBeTruthy());
    const sent = callsTo("/api/v1/stumbles");
    expect(sent).toHaveLength(5);
    expect(sent.every((call) => call.body?.source === "demo" && call.body?.problem === "1/3+1/4")).toBe(true);
  });

  it("送る記録には、選んだ間違い方の種類と、見たヒント 0 個を付ける", async () => {
    routes["POST /api/v1/stumbles"] = () => ({ status: 201, json: { received: true } });
    render(<ResearchPage />);
    expect(screen.getByText(/原因ではありません/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("間違い方の種類（ダミー）"), { target: { value: "sum-num-only" } });
    press("間違えた記録を送る（1 件）");
    await waitFor(() => expect(callsTo("/api/v1/stumbles")).toHaveLength(1));
    expect(callsTo("/api/v1/stumbles")[0]?.body).toMatchObject({ pattern: "sum-num-only", hintsShown: 0, source: "demo" });
  });

  it("集計では、問題の件数と、5 件以上の間違い方の内訳を出す", async () => {
    routes["POST /api/v1/stumbles/query"] = () => ok({
      scope: "summary",
      items: [{ lessonKey: "main-6", problem: "1/3+1/4", count: 9, patterns: [{ pattern: "sum-both", count: 6 }, { pattern: "unclassified", count: 3 }] }],
    });
    render(<ResearchPage />);
    type("読む目的", "調べる");
    press("記録を読む");
    expect(await screen.findByText(/1\/3\+1\/4（main-6）：9 件/)).toBeTruthy();
    expect(await screen.findByText("分子どうし、分母どうしを計算した形：6 件")).toBeTruthy();
    expect(screen.getByText("分類できず：3 件")).toBeTruthy();
  });
});

describe("ResearchPage: 結果の文は、押した段の中に出る", () => {
  it("読む目的が空なら、送らずに、その段の中で書くよう伝える", () => {
    render(<ResearchPage />);
    press("記録を読む");
    const message = screen.getByText("何のために読むかを書いてください");
    expect(stepOf(message)).toBe(stepOf(screen.getByRole("button", { name: "記録を読む" })));
    expect(callsTo("/api/v1/stumbles/query")).toHaveLength(0);
  });

  it("研究者が 1 件ずつの記録を読むと断られ、サーバーの文が、押した段の中に出る。操作の記録も読める", async () => {
    routes["POST /api/v1/stumbles/query"] = () => failure(403, "SCOPE_NOT_ALLOWED", "この役割では、この操作はできません");
    routes["GET /api/v1/audit-log"] = audit([
      { id: 1, at: "2026-11-08T01:00:00.000Z", role: "researcher", action: "query", targetId: "records", detail: null, reason: "のぞく", result: "denied" },
    ]);
    render(<ResearchPage />);
    fireEvent.click(screen.getByLabelText("研究者"));
    fireEvent.click(screen.getByLabelText("1 件ずつの記録"));
    type("読む目的", "のぞく");
    press("記録を読む");
    const message = await screen.findByText("この役割では、この操作はできません");
    expect(stepOf(message)).toBe(stepOf(screen.getByRole("button", { name: "記録を読む" })));
    expect(callsTo("/api/v1/audit-log")).toHaveLength(0);
    press("操作の記録を読み込む");
    expect(await screen.findByText("断られた")).toBeTruthy();
    expect(callsTo("/api/v1/stumbles/query")[0]?.body).toMatchObject({ role: "researcher", scope: "records" });
  });

  it("5 件に満たなくて何も返らないときは、そのわけを、その段の中に出す", async () => {
    routes["POST /api/v1/stumbles/query"] = () => ok({ scope: "summary", items: [] });
    render(<ResearchPage />);
    type("読む目的", "調べる");
    press("記録を読む");
    const message = await screen.findByText(/5 件（仮）に満たないため/);
    expect(stepOf(message)).toBe(stepOf(screen.getByRole("button", { name: "記録を読む" })));
  });

  it("役割を切り替えたら、前の役割の失敗の文を消す", async () => {
    routes["POST /api/v1/stumbles/query"] = () => failure(403, "SCOPE_NOT_ALLOWED", "この役割では、この操作はできません");
    render(<ResearchPage />);
    fireEvent.click(screen.getByLabelText("研究者"));
    fireEvent.click(screen.getByLabelText("1 件ずつの記録"));
    type("読む目的", "のぞく");
    press("記録を読む");
    expect(await screen.findByText("この役割では、この操作はできません")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("先生"));
    expect(screen.queryByText("この役割では、この操作はできません")).toBeNull();
  });

  it("理由が空のまま承認しようとしたら、承認の段の中で伝え、送らない", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    press("この案を承認する");
    const message = screen.getByText("理由を書いてください");
    expect(stepOf(message)).toBe(stepOf(screen.getByRole("button", { name: "この案を承認する" })));
    expect(callsTo("/api/v1/suggestions/suggestion-1/decision")).toHaveLength(0);
  });
});

describe("ResearchPage: 提案から次の子の画面まで", () => {
  it("承認まで進むと、次の子の画面に、承認された直し方が出る", async () => {
    let approved: unknown[] = [];
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    routes["POST /api/v1/suggestions/suggestion-1/decision"] = () => {
      approved = [{ pattern: "sum-both", replacesHintIndex: 0, hint: "共通の単位を先に見せましょう" }];
      return ok({ id: "suggestion-1", status: "approved", replaced: ["suggestion-old"] });
    };
    routes["GET /api/v1/approved-hints"] = () => ok({ items: approved });
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    expect(await screen.findByLabelText("提案")).toBeTruthy();
    type("理由", "単位を先に示す");
    fireEvent.click(screen.getByRole("radio", { name: /表の案 1/ }));
    press("この案を承認する");
    const replacementNotice = await screen.findByText("前の承認（suggestion-old）を置き換えました");
    expect(stepOf(replacementNotice)).toBe(stepOf(screen.getByRole("button", { name: "この案を承認する" })));
    const marked = await screen.findByText(/共通の単位を先に見せましょう/, { selector: "li" });
    expect(marked.textContent).toContain("承認された直し方");
    expect(callsTo("/api/v1/suggestions/suggestion-1/decision")[0]?.body).toMatchObject({ role: "teacher", decision: "approved", candidateNumber: 1, reason: "単位を先に示す" });
  });

  it("承認した案は理由を添えて取り消せ、状態と次の子の画面が更新される", async () => {
    let approved: unknown[] = [];
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    routes["POST /api/v1/suggestions/suggestion-1/decision"] = () => {
      approved = [{ pattern: "sum-both", replacesHintIndex: 0, hint: "共通の単位を先に見せましょう" }];
      return ok({ id: "suggestion-1", status: "approved" });
    };
    routes["POST /api/v1/suggestions/suggestion-1/revoke"] = () => {
      approved = [];
      return ok({ id: "suggestion-1", status: "revoked" });
    };
    routes["GET /api/v1/approved-hints"] = () => ok({ items: approved });
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    type("理由", "単位を先に示す");
    press("この案を承認する");
    await screen.findByText("承認しました");
    type("理由", "内容を見直します");
    press("承認を取り消す");
    const message = await screen.findByText("承認を取り消しました");
    const status = screen.getByText(/いまの状態：取り消した/);
    expect(stepOf(message)).toBe(stepOf(status));
    await waitFor(() => expect(screen.getByText("承認された直し方はまだありません")).toBeTruthy());
    expect(callsTo("/api/v1/suggestions/suggestion-1/revoke")[0]?.body).toMatchObject({ role: "teacher", reason: "内容を見直します" });
  });

  it("提案のあとに、直したい間違い方の選択を変えても、承認と読み直しは、提案した種類のまま", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("same-den-sum", "suggestion-2") });
    routes["POST /api/v1/suggestions/suggestion-2/decision"] = () => ok({ id: "suggestion-2", status: "approved" });
    routes["GET /api/v1/approved-hints"] = () => ok({ items: [] });
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    fireEvent.change(screen.getByLabelText("直したい間違い方"), { target: { value: "same-den-sum" } });
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    expect(callsTo("/api/v1/suggestions")[0]?.body).toMatchObject({ pattern: "same-den-sum" });
    fireEvent.change(screen.getByLabelText("直したい間違い方"), { target: { value: "sum-both" } });
    type("理由", "よさそう");
    press("この案を承認する");
    await screen.findByText("承認しました");
    const hintCall = callsTo("/api/v1/approved-hints")[0];
    expect(new URLSearchParams(hintCall?.search).get("pattern")).toBe("same-den-sum");
  });

  it("承認がないときは、承認された直し方がまだ無いと出す", () => {
    render(<ResearchPage />);
    expect(screen.getByText("承認された直し方はまだありません")).toBeTruthy();
  });
});

describe("ResearchPage: 承認キー", () => {
  it("画面上のキー欄を学びの輪と教材スタジオの両方で使う", async () => {
    routes["POST /api/v1/studio/compile"] = () => ok({
      lesson: {
        schemaVersion: 1,
        objective: "分母をそろえる意味をタイルで考えます",
        strategy: "visual",
        problems: [{ kind: "calculate", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, operator: "+", hints: ["同じ大きさのタイルでうめられるか考えましょう"] }],
      },
      source: "mock",
      validation: { ok: true },
    });
    routes["POST /api/v1/studio/lessons"] = () => ({ status: 201, json: {
      id: "studio-1@v1", lessonId: "studio-1", number: 1, lesson: {
        schemaVersion: 1,
        objective: "分母をそろえる意味をタイルで考えます",
        strategy: "visual",
        problems: [{ kind: "calculate", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, operator: "+", hints: ["同じ大きさのタイルでうめられるか考えましょう"] }],
      }, validation: { ok: true },
    } });
    routes["POST /api/v1/studio/lessons/studio-1/versions/1/decision"] = (call) => {
      expect(call.headers["x-approver-key"]).toBe("shared-key");
      return ok({ version: { id: "studio-1@v1", lessonId: "studio-1", number: 1, lesson: {}, validation: { ok: true } } });
    };
    render(<ResearchPage />);
    fireEvent.change(screen.getByLabelText(/^承認キー/), { target: { value: "shared-key" } });
    expect(screen.getAllByLabelText(/^承認キー/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "教材をつくる" }));
    expect(screen.getAllByLabelText(/^承認キー/)).toHaveLength(1);
    type("先生が一文で書く", "分数を考える教材を作る");
    press("教材を生成する");
    await screen.findByText("検査に通りました");
    type("理由", "内容を確認しました");
    press("承認する");
    await screen.findByText(/状態：承認済み/);
    expect(callsTo("/api/v1/studio/lessons/studio-1/versions/1/decision")[0]?.headers["x-approver-key"]).toBe("shared-key");
  });

  it("承認キーを入れると、承認と操作の記録の読み込みに、ヘッダーで付ける", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    routes["POST /api/v1/suggestions/suggestion-1/decision"] = () => ok({ id: "suggestion-1", status: "approved" });
    routes["GET /api/v1/approved-hints"] = () => ok({ items: [] });
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    fireEvent.change(screen.getByLabelText(/^承認キー/), { target: { value: "secret-key" } });
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    type("理由", "よい");
    press("この案を承認する");
    await screen.findByText("承認しました");
    expect(callsTo("/api/v1/suggestions/suggestion-1/decision")[0]?.headers["x-approver-key"]).toBe("secret-key");
    press("操作の記録を読み込む");
    await waitFor(() => expect(callsTo("/api/v1/audit-log").length).toBeGreaterThan(1));
    expect(callsTo("/api/v1/audit-log").every((call) => call.headers["x-approver-key"] === "secret-key")).toBe(true);
  });

  it("承認キーが空なら、ヘッダーを付けない", async () => {
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    press("操作の記録を読み込む");
    await waitFor(() => expect(callsTo("/api/v1/audit-log")).toHaveLength(1));
    expect("x-approver-key" in (callsTo("/api/v1/audit-log")[0]?.headers ?? {})).toBe(false);
  });

  it("キーが無い、または違うときは、サーバーの文が、承認の段の中に出る", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    routes["POST /api/v1/suggestions/suggestion-1/decision"] = () => failure(401, "UNAUTHORIZED", "承認キーが必要か、合っていません");
    routes["GET /api/v1/audit-log"] = audit();
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    type("理由", "よい");
    press("この案を承認する");
    const message = await screen.findByText("承認キーが必要か、合っていません");
    expect(stepOf(message)).toBe(stepOf(screen.getByRole("button", { name: "この案を承認する" })));
  });

  it("キーの欄は、伏せ字で、ブラウザーに保存しない", () => {
    render(<ResearchPage />);
    const field = screen.getByLabelText(/^承認キー/) as HTMLInputElement;
    expect(field.type).toBe("password");
    expect(field.autocomplete).toBe("off");
    fireEvent.change(field, { target: { value: "secret-key" } });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("ResearchPage: 幅の小さい画面と読み上げ", () => {
  it("操作の記録の表は、名前を持つ、動かせる枠に入れ、動かせることを書く", () => {
    render(<ResearchPage />);
    const region = screen.getByRole("region", { name: "操作の記録の表" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(screen.getByText(/横にすべらせると/)).toBeTruthy();
  });

  it("表には、読み上げ用の名前と、列の見出しの役割がある", async () => {
    routes["GET /api/v1/audit-log"] = audit([
      { id: 1, at: "2026-11-08T01:00:00.000Z", role: "teacher", action: "decide", targetId: "suggestion-1", detail: "approved", reason: "よい", result: "allowed" },
    ]);
    render(<ResearchPage />);
    press("操作の記録を読み込む");
    const table = await screen.findByRole("table", { name: "操作の記録" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
  });

  it("提案の結果は、名前を持つ領域に入れる", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: suggestionOf("sum-both") });
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    expect(await screen.findByRole("region", { name: "提案" })).toBeTruthy();
  });

  it("AI 下書きには確認の案内を出し、表に戻した理由も示す", async () => {
    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: { ...suggestionOf("sum-both"), generatedBy: "gemini", candidates: [
      { number: 1, source: "gemini", hint: "共通の単位を見つけましょう", passed: true },
      { number: 2, source: "gemini", hint: "答えは7/12です", passed: false, reason: "leak" },
      { number: 3, source: "table", hint: "共通の単位を先に見せましょう", passed: true },
    ] } });
    render(<ResearchPage />);
    type("読む目的", "直す");
    press("直し方の案をつくる");
    await screen.findByLabelText("提案");
    expect(screen.getByText(/Gemini の案 1/)).toBeTruthy();
    expect(screen.getByText(/先生が確かめてから承認してください/)).toBeTruthy();
    expect(screen.getByText(/答えが分かるおそれがあります/)).toBeTruthy();
    expect((screen.getByRole("radio", { name: /Gemini の案 2/ }) as HTMLInputElement).disabled).toBe(true);

    routes["POST /api/v1/suggestions"] = () => ({ status: 201, json: { ...suggestionOf("sum-both"), aiFallback: "check_failed" } });
    press("直し方の案をつくる");
    expect(await screen.findByText(/AI の文が検査に通らなかったので、表の文にしました/)).toBeTruthy();
  });
});
