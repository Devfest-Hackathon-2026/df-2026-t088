import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GradeOneLesson } from "./GradeOneLesson";
describe("1ねんせいの学習", () => {
  it("解き方はヒントに分け、最初の図では答えの作り方を出さない", () => {
    const { container, unmount } = render(<GradeOneLesson topic="carry" onExit={vi.fn()} onFinish={vi.fn()} />);
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("8に2を");
    expect(container.querySelector(".grade-one__diagram")?.textContent).not.toContain("2 ＋ 3");
    unmount();
    const borrow = render(<GradeOneLesson topic="borrow" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(borrow.container.querySelector(".grade-one__diagram")?.textContent).not.toContain("10 − 5");
    borrow.unmount();
    render(<GradeOneLesson topic="clock" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText("とけいを みて、なんじか よもう。")).toBeTruthy();
    expect(screen.queryByText(/みじかい はりが3、ながい はりが12を さしています/)).toBeNull();
  });
  it("まちがいを訂正し、正しい式を選んで終える", () => {
    const finish = vi.fn();
    render(<GradeOneLesson topic="addition" onExit={vi.fn()} onFinish={finish} />);
    fireEvent.change(screen.getByRole("textbox", { name: "どの しきに なるかな？" }), { target: { value: "3-2" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByRole("status").textContent).toContain("もういちど");
    fireEvent.change(screen.getByRole("textbox", { name: "どの しきに なるかな？" }), { target: { value: "３たす２" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByRole("status").textContent).toContain("5こ");
    fireEvent.click(screen.getByRole("button", { name: "ばんめんにもどる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
  it("足す・引くの意味を、問題と異なる数で見てから進む", () => {
    const addition = render(<GradeOneLesson topic="addition" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(/りんごが3こ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "たしざんの せつめいを みる" }));
    expect(screen.getByRole("heading", { name: "たしざんを しろう" })).toBeTruthy();
    expect(screen.queryByText(/りんごが3こ/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "あわせる" }));
    expect(screen.getByText("1 ＋ 1 ＝ 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もんだいに すすむ" }));
    expect(screen.getByText(/りんごが3こ/)).toBeTruthy();
    addition.unmount();
    render(<GradeOneLesson topic="subtraction" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(/りんごが5こ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ひきざんの せつめいを みる" }));
    expect(screen.getByRole("heading", { name: "ひきざんを しろう" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1こ とりのぞく" }));
    expect(screen.getByText("4 − 1 ＝ 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "もんだいに すすむ" }));
    expect(screen.getByText(/りんごが5こ/)).toBeTruthy();
  });
  it("まとめは複数の問題を終えてから完了する", () => {
    const finish = vi.fn();
    render(<GradeOneLesson topic="compare" topics={["compare", "count"]} onExit={vi.fn()} onFinish={finish} />);
    fireEvent.change(screen.getByRole("textbox", { name: "どちらが おおい？" }), { target: { value: "みかん" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    fireEvent.click(screen.getByRole("button", { name: "つぎの問題へ" }));
    expect(finish).not.toHaveBeenCalled();
    expect(screen.getByText("ほしは なんこ あるかな？")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "なんこ？" }), { target: { value: "６" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    fireEvent.click(screen.getByRole("button", { name: "ばんめんにもどる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
  it("答える前には10ずつの計算結果や人数別の答えを出さない", () => {
    const { unmount } = render(<GradeOneLesson topic="tens-unit" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.queryByText(/10、20、30/)).toBeNull();
    expect(screen.queryByText(/10　→　20　→　30/)).toBeNull();
    unmount();
    render(<GradeOneLesson topic="groups" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.queryByText(/ひとりめ　🍬 🍬 🍬/)).toBeNull();
  });
  it("100を求める前に見出しへ答えを出さない", () => {
    render(<GradeOneLesson topic="hundred" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("100");
    expect(screen.queryByText(/10が10こで 100/)).toBeNull();
  });
  it("生活の時計は図を読み、8時を入力する", () => {
    render(<GradeOneLesson topic="daily-time" onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.queryByText(/おやつの じかん/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "なんじ？" }), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByRole("status").textContent).toContain("8じ");
  });
});
