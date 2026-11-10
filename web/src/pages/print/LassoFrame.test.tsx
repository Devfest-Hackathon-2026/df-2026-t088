import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LassoFrame } from "./LassoFrame";
import type { Point } from "./types";

// 写真 1000×800 を、表示 500×400 で出している（1 表示px = 2 画素）
const BOX = { left: 0, top: 0, width: 500, height: 400, right: 500, bottom: 400, x: 0, y: 0, toJSON: () => ({}) };
let rectSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(BOX as DOMRect);
});
afterEach(() => rectSpy.mockRestore());

function setup(path: Point[] = [], placeOnTap = false) {
  const onPathChange = vi.fn();
  const view = render(
    <LassoFrame src="blob:photo" width={1000} height={800} path={path} onPathChange={onPathChange} label="写真の枠" description="Enter で四角を置く" placeOnTap={placeOnTap} />,
  );
  const svg = view.container.querySelector(".lasso__svg") as SVGSVGElement;
  const frame = screen.getByRole("group", { name: "写真の枠" });
  return { onPathChange, svg, frame, view };
}

const down = (svg: Element, x: number, y: number) => fireEvent.pointerDown(svg, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0 });
const move = (svg: Element, x: number, y: number) => fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch" });
const up = (svg: Element) => fireEvent.pointerUp(svg, { pointerId: 1, pointerType: "touch" });

describe("LassoFrame", () => {
  it("枠に名前と説明が付き、キーボードで届く", () => {
    const { frame } = setup();
    expect(frame.tabIndex).toBe(0);
    expect(frame.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(frame.getAttribute("aria-describedby")!)?.textContent).toBe("Enter で四角を置く");
  });

  it("なぞって離すと、写真の画素の座標で線を渡す（4px 未満の点は足さない）", () => {
    const { svg, onPathChange } = setup();
    down(svg, 10, 10);
    move(svg, 11, 11); // 4px 未満なので足さない
    move(svg, 200, 10);
    move(svg, 200, 150);
    move(svg, 10, 150);
    up(svg);
    expect(onPathChange).toHaveBeenCalledTimes(1);
    expect(onPathChange.mock.calls[0][0]).toEqual([
      { x: 20, y: 20 },
      { x: 400, y: 20 },
      { x: 400, y: 300 },
      { x: 20, y: 300 },
    ]);
  });

  it("写真の外へ出た点は縁へ寄せる", () => {
    const { svg, onPathChange } = setup();
    down(svg, -30, -30);
    move(svg, 700, 10);
    move(svg, 700, 500);
    up(svg);
    expect(onPathChange.mock.calls[0][0]).toEqual([
      { x: 0, y: 0 },
      { x: 1000, y: 20 },
      { x: 1000, y: 800 },
    ]);
  });

  it("線がある時は、触れただけ（点が3つ未満）では線を変えない", () => {
    const { svg, onPathChange } = setup([{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }], true);
    down(svg, 10, 10);
    move(svg, 100, 10);
    up(svg);
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("placeOnTap が無い画面（先生の画面）では、線が無くても押しただけでは何もしない", () => {
    const { svg, onPathChange } = setup();
    down(svg, 250, 200);
    up(svg);
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("placeOnTap の時、線が無い時に1回押すと、Enter と同じ内側 90% の四角を置く（読み上げのダブルタップ。D-204）", () => {
    const { svg, onPathChange, view } = setup([], true);
    down(svg, 250, 200);
    up(svg);
    expect(onPathChange).toHaveBeenCalledTimes(1);
    const [p0, , p2] = onPathChange.mock.calls[0][0] as Point[];
    expect(p0.x).toBeCloseTo(50);
    expect(p0.y).toBeCloseTo(40);
    expect(p2.x).toBeCloseTo(950);
    expect(p2.y).toBeCloseTo(760);
    // 四角なので、矢印キーで動かせる印（四隅の丸）を出す
    view.rerender(
      <LassoFrame src="blob:photo" width={1000} height={800} path={onPathChange.mock.calls[0][0]} onPathChange={onPathChange} label="写真の枠" description="Enter で四角を置く" placeOnTap />,
    );
    expect(view.container.querySelectorAll(".lasso__handle")).toHaveLength(4);
  });

  it("押している途中で取り消された（pointercancel）時は、四角を置かない", () => {
    const { svg, onPathChange } = setup([], true);
    down(svg, 250, 200);
    fireEvent.pointerCancel(svg, { pointerId: 1, pointerType: "touch" });
    expect(onPathChange).not.toHaveBeenCalled();
  });

  it("閉じた線がある時は、外を暗くする", () => {
    const path = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }];
    const { view } = setup(path);
    expect(view.container.querySelector(".lasso__dim")).not.toBeNull();
    expect(view.container.querySelector(".lasso__line")).not.toBeNull();
  });

  it("線が無い時は暗くしない", () => {
    const { view } = setup();
    expect(view.container.querySelector(".lasso__dim")).toBeNull();
  });

  it("Enter で内側 90% の四角を置く", () => {
    const { frame, onPathChange } = setup();
    fireEvent.keyDown(frame, { key: "Enter" });
    expect(onPathChange).toHaveBeenCalledTimes(1);
    const [p0, p1, p2] = onPathChange.mock.calls[0][0] as Point[];
    expect(p0.x).toBeCloseTo(50);
    expect(p0.y).toBeCloseTo(40);
    expect(p1.x).toBeCloseTo(950);
    expect(p2.y).toBeCloseTo(760);
  });

  it("矢印で表示の 8px（= 16 画素）動かし、Shift と矢印で右下の角を動かす", () => {
    const path: Point[] = [];
    const calls: Point[][] = [];
    function Host() {
      const [value, setValue] = useState<Point[]>(path);
      return <LassoFrame src="blob:p" width={1000} height={800} path={value} onPathChange={(next) => { calls.push(next); setValue(next); }} label="枠" description="説明" />;
    }
    render(<Host />);
    const frame = screen.getByRole("group", { name: "枠" });
    fireEvent.keyDown(frame, { key: "ArrowLeft" }); // 四角が無い間は何もしない
    expect(calls).toHaveLength(0);
    fireEvent.keyDown(frame, { key: "Enter" });
    fireEvent.keyDown(frame, { key: "ArrowLeft" });
    expect(calls[1][0].x).toBeCloseTo(50 - 16);
    fireEvent.keyDown(frame, { key: "ArrowDown" });
    expect(calls[2][0].y).toBeCloseTo(40 + 16);
    fireEvent.keyDown(frame, { key: "ArrowUp", shiftKey: true });
    // 右下の角が 16 画素上がる。左上はそのまま
    expect(calls[3][0]).toEqual(calls[2][0]);
    expect(calls[3][2].y).toBeCloseTo(calls[2][2].y - 16);
  });
});
