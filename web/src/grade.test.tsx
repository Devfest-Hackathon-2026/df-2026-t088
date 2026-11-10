import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCOUNT_KEY, LEGACY_GRADE_KEY } from "./account";
import { GradeProvider, useGrade, useGradeControl, useText } from "./grade";
import { useGame } from "./game/use-game";

beforeEach(() => localStorage.clear());

describe("GradeProvider", () => {
  it("Provider の外では null（漢字のまま）、useText は注記を外すだけ", () => {
    expect(renderHook(() => useGrade()).result.current).toBeNull();
    expect(renderHook(() => useGradeControl()).result.current).toBeNull();
    expect(renderHook(() => useText()("[盤面|ばんめん]")).result.current).toBe("盤面");
  });

  it("アカウントの grade を読む", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    const { result } = renderHook(() => useGrade(), { wrapper: GradeProvider });
    expect(result.current).toBe(3);
  });

  it("古いキーだけがある端末では取り込んで、古いキーを消す", () => {
    localStorage.setItem(LEGACY_GRADE_KEY, "2");
    const { result } = renderHook(() => useGrade(), { wrapper: GradeProvider });
    expect(result.current).toBe(2);
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual({ avatarId: "default", grade: 2 });
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBeNull();
  });

  it("Provider の中は保存した学年、無ければ 6。切り替えると残る", () => {
    const wrapper = GradeProvider;
    const first = renderHook(() => useGradeControl(), { wrapper });
    expect(first.result.current?.grade).toBe(6);
    act(() => first.result.current?.setGrade(1));
    expect(first.result.current?.grade).toBe(1);
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual({ avatarId: "default", grade: 1 });
    first.unmount();
    const second = renderHook(() => useText(), { wrapper });
    expect(second.result.current("[前|まえ]へ[盤面|ばんめん]")).toBe("まえへばんめん");
  });

  it("「はじめからにする」でも学年は消えない", () => {
    function Probe() {
      const game = useGame();
      const control = useGradeControl();
      return (
        <>
          <button type="button" onClick={() => control?.setGrade(3)}>学年3</button>
          <button type="button" onClick={() => { game.reset(); }}>reset</button>
        </>
      );
    }
    render(<GradeProvider><Probe /></GradeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "学年3" }));
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null")).toEqual({ avatarId: "default", grade: 3 });
  });
});
