import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedMidwayState } from "../../../game/test-state";
import { useGame } from "../../../game/use-game";
import type { Game } from "../../../game/use-game";
import { Panel } from "../../../components/Panel";
import { BoardDialogs } from "./BoardDialogs";
import { ResetBody } from "./PanelBodies";
import type { BoardDialog } from "./types";

// 5年の分数の教材を確かめる。Provider を使うと文字が5年の表示（漢字がかなに替わる）になるので、初めの学年だけ5年にする（開発中に5年を選んだ時。FR-012）
vi.mock("../../../grade", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../grade")>()), DEFAULT_GRADE: 5 }));


beforeEach(() => {
  localStorage.clear();
  seedMidwayState();
});

// 状態が変わると描き直されるよう、useGame は部品の中で呼ぶ
function setup(dialog: BoardDialog | null, prepare?: (game: Game) => void) {
  const hook: { result: { current: Game } } = { result: { current: null as unknown as Game } };
  const onClose = vi.fn();
  function Harness() {
    const game = useGame();
    hook.result.current = game;
    return <BoardDialogs game={game} dialog={dialog} onClose={onClose} />;
  }
  const view = render(<Harness />);
  if (prepare) act(() => prepare(hook.result.current));
  return { ...view, hook, onClose };
}

describe("最初の説明", () => {
  it("途中から始まる理由と「分かんない」を説明し、ボタンは閉じるだけ", () => {
    const { onClose } = setup({ type: "intro" });
    expect(screen.getByRole("dialog", { name: "分数の章の途中から始めます" })).toBeTruthy();
    expect(screen.getByText(/算数 Lv\.5 から始めます/)).toBeTruthy();
    expect(screen.getByText(/「分かんない」をおしてください/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "やってみる" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("確認のパネル（ResetBody。アカウントのパネルから開く）", () => {
  it("最初のフォーカスは「やめる」で、押すと onReset を呼ぶのは「はじめからにする」", async () => {
    const onClose = vi.fn();
    const onReset = vi.fn();
    render(<Panel open onClose={onClose} labelledBy="reset-title"><ResetBody onClose={onClose} onReset={onReset} /></Panel>);
    const cancel = screen.getByRole("button", { name: "やめる" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    expect(cancel.className).toContain("button--primary");
    const reset = screen.getByRole("button", { name: "はじめからにする" });
    expect(reset.className).toContain("button--secondary");
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("レベルアップ", () => {
  it("経験値で上がると開き、「やったね」で閉じる", async () => {
    vi.useFakeTimers();
    const { hook } = setup(null);
    for (const index of [3, 4, 5]) {
      await act(async () => {
        const finished = hook.result.current.completeLesson({ kind: "main", index });
        await vi.advanceTimersByTimeAsync(1500);
        await finished;
      });
    }
    vi.useRealTimers();
    expect(screen.getByRole("heading", { name: "レベルアップ！ Lv.10" })).toBeTruthy();
    expect(screen.getByText("マントを手に入れました")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "やったね" }));
    expect(hook.result.current.levelUp).toBeNull();
  });
});
