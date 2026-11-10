import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MUTED_KEY, VOLUME_KEY } from "../audio/bgm";
import { setBgmForTest } from "../audio/use-bgm";
import { SoundButton } from "./SoundButton";

describe("CMP-016 音のボタン", () => {
  beforeEach(() => {
    localStorage.clear();
    setBgmForTest(null);
  });
  afterEach(() => setBgmForTest(null));

  it("押すたびに、消すと出すを入れ替えて端末に残す", () => {
    render(<SoundButton />);
    fireEvent.click(screen.getByRole("button", { name: "音を消す" }));
    expect(localStorage.getItem(MUTED_KEY)).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "音を出す" }));
    expect(localStorage.getItem(MUTED_KEY)).toBe("0");
    expect(screen.getByRole("button", { name: "音を消す" })).toBeTruthy();
  });

  it("前に消していたら、消してある形で出す", () => {
    localStorage.setItem(MUTED_KEY, "1");
    render(<SoundButton />);
    expect(screen.getByRole("button", { name: "音を出す" })).toBeTruthy();
  });
  it("バーで BGM の大きさを変え、端末に残す（D-203）", () => {
    render(<SoundButton />);
    const range = screen.getByRole("slider", { name: "音楽の大きさ" }) as HTMLInputElement;
    expect(range.value).toBe("50");
    fireEvent.change(range, { target: { value: "80" } });
    expect(localStorage.getItem(VOLUME_KEY)).toBe("0.8");
    expect(range.value).toBe("80");
  });

  it("前に選んだ大きさは、作り直しても（ログアウトの後も）そのまま", () => {
    localStorage.setItem(VOLUME_KEY, "0.3");
    render(<SoundButton bar />);
    expect((screen.getByRole("slider", { name: "音楽の大きさ" }) as HTMLInputElement).value).toBe("30");
  });

  it("バーを左いっぱいにすると消し、ボタンもバーも消した形になる", () => {
    localStorage.setItem(VOLUME_KEY, "0.6");
    render(<SoundButton />);
    const range = screen.getByRole("slider", { name: "音楽の大きさ" }) as HTMLInputElement;
    fireEvent.change(range, { target: { value: "0" } });
    expect(localStorage.getItem(MUTED_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "音を出す" })).toBeTruthy();
    expect(range.value).toBe("0");
    expect(range.dataset.empty).toBe("true");
    // ボタンで出すと、0 にする前の大きさに戻る
    fireEvent.click(screen.getByRole("button", { name: "音を出す" }));
    expect(range.value).toBe("60");
    expect(range.dataset.empty).toBe("false");
  });

  it("消してある時はバーを0に見せ、動かすと音を出す", () => {
    localStorage.setItem(MUTED_KEY, "1");
    render(<SoundButton />);
    const range = screen.getByRole("slider", { name: "音楽の大きさ" }) as HTMLInputElement;
    expect(range.value).toBe("0");
    fireEvent.change(range, { target: { value: "40" } });
    expect(localStorage.getItem(MUTED_KEY)).toBe("0");
    expect(screen.getByRole("button", { name: "音を消す" })).toBeTruthy();
  });

  describe("開き方（D-241、CP-1266）", () => {
    const stubPointer = (fine: boolean) =>
      vi.stubGlobal("matchMedia", (query: string) => ({ matches: fine && query.includes("hover: hover"), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    const slider = () => screen.getByRole("slider", { name: "音楽の大きさ" });
    const isOpen = (container: HTMLElement) => container.querySelector(".sound-control")?.getAttribute("data-open") === "true";
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it("ふだんは閉じていて、バーは inert で Tab にも届かない", () => {
      stubPointer(true);
      const { container } = render(<SoundButton />);
      expect(isOpen(container)).toBe(false);
      expect(slider().hasAttribute("inert")).toBe(true);
    });

    it("マウスは丸に乗せると開き、外れて 400ms で閉じる。その間に戻れば閉じない", () => {
      stubPointer(true);
      vi.useFakeTimers();
      const { container } = render(<SoundButton />);
      const root = container.querySelector(".sound-control") as HTMLElement;
      fireEvent.pointerEnter(root);
      expect(isOpen(container)).toBe(true);
      expect(slider().hasAttribute("inert")).toBe(false);
      fireEvent.pointerLeave(root);
      act(() => { vi.advanceTimersByTime(300); });
      fireEvent.pointerEnter(root);
      act(() => { vi.advanceTimersByTime(500); });
      expect(isOpen(container)).toBe(true);
      fireEvent.pointerLeave(root);
      act(() => { vi.advanceTimersByTime(400); });
      expect(isOpen(container)).toBe(false);
    });

    it("マウスでスピーカーを押すと消す・出す。aria-expanded は付けない", () => {
      stubPointer(true);
      render(<SoundButton />);
      const speaker = screen.getByRole("button", { name: "音を消す" });
      expect(speaker.hasAttribute("aria-expanded")).toBe(false);
      fireEvent.click(speaker);
      expect(localStorage.getItem(MUTED_KEY)).toBe("1");
    });

    it("キーボードはスピーカーのフォーカスで開き、Esc で閉じてスピーカーへフォーカスが戻る。外へ出ても閉じる", () => {
      stubPointer(true);
      const { container } = render(<><SoundButton /><button type="button">となり</button></>);
      const speaker = screen.getByRole("button", { name: "音を消す" });
      act(() => speaker.focus());
      expect(isOpen(container)).toBe(true);
      expect(container.querySelector(".sound-control")?.getAttribute("data-instant")).toBe("true");
      act(() => slider().focus());
      expect(isOpen(container)).toBe(true);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(isOpen(container)).toBe(false);
      expect(slider().hasAttribute("inert")).toBe(true);
      expect(document.activeElement).toBe(speaker);
      act(() => screen.getByRole("button", { name: "となり" }).focus());
      act(() => speaker.focus());
      expect(isOpen(container)).toBe(true);
      act(() => screen.getByRole("button", { name: "となり" }).focus());
      expect(isOpen(container)).toBe(false);
    });

    it("タッチは閉じている丸を押した1回は開くだけで、開いてから押すと消す", () => {
      stubPointer(false);
      const { container } = render(<SoundButton />);
      const trigger = screen.getByRole("button", { name: "音のせってい" });
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(trigger);
      expect(isOpen(container)).toBe(true);
      expect(localStorage.getItem(MUTED_KEY)).toBeNull();
      const speaker = screen.getByRole("button", { name: "音を消す" });
      expect(speaker.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(speaker);
      expect(localStorage.getItem(MUTED_KEY)).toBe("1");
      expect(screen.getByRole("button", { name: "音を出す" })).toBeTruthy();
    });

    it("タッチで開いた札は、札の外を押すか Esc で閉じる。札の中を押しても閉じない", () => {
      stubPointer(false);
      const { container } = render(<SoundButton />);
      fireEvent.click(screen.getByRole("button", { name: "音のせってい" }));
      fireEvent.pointerDown(slider());
      expect(isOpen(container)).toBe(true);
      fireEvent.pointerDown(document.body);
      expect(isOpen(container)).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "音のせってい" }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(isOpen(container)).toBe(false);
      expect(screen.getByRole("button", { name: "音のせってい" }).getAttribute("aria-expanded")).toBe("false");
    });

    it("伸びる向きは grow で決める（既定は左）", () => {
      stubPointer(true);
      const { container, rerender } = render(<SoundButton />);
      expect(container.querySelector(".sound-control")?.getAttribute("data-grow")).toBe("left");
      rerender(<SoundButton grow="right" />);
      expect(container.querySelector(".sound-control")?.getAttribute("data-grow")).toBe("right");
    });
  });
});
