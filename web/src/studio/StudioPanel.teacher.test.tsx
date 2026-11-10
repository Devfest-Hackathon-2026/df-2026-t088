import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioPanel } from "./StudioPanel";
import { StudioPage } from "../teacher/StudioPage";

// #374：先生の画面（variant="teacher"）では、研究用の言葉（mock・版・差分・strategy・根拠と出どころ）を出さない
const BANNED = [/mock/, /Gemini/, /版/, /差分/, /strategy/, /根拠と出どころ/, /ダミーのデータ/, /StepNotice/];

async function generate() {
  fireEvent.change(screen.getByLabelText("先生が一文で書く"), { target: { value: "分母をそろえる教材を作る" } });
  fireEvent.click(screen.getByRole("button", { name: "教材を生成する" }));
  await screen.findByText("検査に通りました");
}

describe("StudioPanel（先生の画面）", () => {
  it("最初から、研究デモの注意と mock の文を出さない", () => {
    render(<StudioPanel variant="teacher" />);
    expect(screen.queryByRole("note")).toBeNull();
    expect(document.body.textContent).not.toMatch(/mock|ダミーのデータ/);
  });

  it("生成・承認・次の教材・違いまで、先生の言葉で進む。くわしい記録は折りたたまれている", async () => {
    render(<StudioPanel variant="teacher" />);
    await generate();
    expect(screen.getByText("いまの教材：1 回目")).toBeTruthy();
    expect(screen.getByText(/見本の教材で続けています|見本の教材です/)).toBeTruthy();
    const more = document.querySelector("details.studio-panel__more") as HTMLDetailsElement;
    expect(more.open).toBe(false);
    expect(within(more).getByText("くわしい記録（つくった履歴と検査の結果）")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "内容を確認しました" } });
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    expect(await screen.findByText("1 回目の状態：承認済み")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2 回目を作る" }));
    expect(await screen.findByText("2 回目の教材を作りました。内容を確かめてください")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "前との違いを見る" }));
    expect(screen.getByRole("region", { name: "前との違い" }).textContent).toBe("1 回目と 2 回目の違い教え方: 図で考える → 数で考える");
    more.open = true;
    for (const word of BANNED) { const text = document.body.textContent ?? ""; expect(text.match(word), `${word}: ${text.slice(Math.max(0, text.search(word) - 30), text.search(word) + 30)}`).toBeNull(); }
  });

  it("「作り直す」は赤い主ボタンにしない（最初の「教材を生成する」だけが主ボタン）", async () => {
    render(<StudioPanel variant="teacher" />);
    expect(screen.getByRole("button", { name: "教材を生成する" }).className).toContain("button--primary");
    await generate();
    expect(screen.getByRole("button", { name: "作り直す" }).className).not.toContain("button--primary");
  });
});

describe("StudioPanel（既定は研究用のまま）", () => {
  it("variant を付けないときは、今までの言葉を出す", async () => {
    render(<StudioPanel />);
    expect(screen.getByText("mock（本物の Gemini ではない）")).toBeTruthy();
    await generate();
    expect(screen.getByText("現在の版：版 1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "根拠と出どころ" })).toBeTruthy();
  });
});

describe("StudioPage（?view=studio）", () => {
  it("上の並びに「教材をつくる」を出し、いまの画面として印を付ける。研究デモの注意は出さない", () => {
    render(<StudioPage />);
    const link = screen.getByRole("link", { name: "教材をつくる" });
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 1, name: "教材をつくる" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/ダミーのデータ|mock/);
  });
});

describe("印刷する（#374）", () => {
  it("教材ができたら「印刷する」が出て、押すと window.print を呼ぶ。研究用には出さない", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<StudioPanel variant="teacher" />);
    expect(screen.queryByRole("button", { name: "印刷する" })).toBeNull();
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "印刷する" }));
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
