import { afterEach, describe, expect, it, vi } from "vitest";
import { cropToLasso, isTooSmall, lassoBounds, rectPath, scaledSize } from "./capture";

describe("lassoBounds", () => {
  it("点の列の外接の四角", () => {
    expect(lassoBounds([{ x: 10, y: 20 }, { x: 50, y: 30 }, { x: 30, y: 80 }])).toEqual({ x: 10, y: 20, width: 40, height: 60 });
  });
  it("点が無ければ 0", () => {
    expect(lassoBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe("isTooSmall", () => {
  it("面積が 5% 未満なら true、5% ちょうどは false", () => {
    expect(isTooSmall({ x: 0, y: 0, width: 20, height: 20 }, 100, 100)).toBe(true);
    expect(isTooSmall({ x: 0, y: 0, width: 50, height: 10 }, 100, 100)).toBe(false);
    expect(isTooSmall({ x: 0, y: 0, width: 80, height: 80 }, 100, 100)).toBe(false);
  });
  it("写真の大きさが 0 なら true", () => {
    expect(isTooSmall({ x: 0, y: 0, width: 1, height: 1 }, 0, 0)).toBe(true);
  });
});

describe("rectPath", () => {
  it("左上から時計回りの4点", () => {
    expect(rectPath({ x: 1, y: 2, width: 3, height: 4 })).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 6 },
      { x: 1, y: 6 },
    ]);
  });
});

describe("scaledSize", () => {
  it("小さければそのまま", () => {
    expect(scaledSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it("長い辺が 1600 になるように縮める", () => {
    expect(scaledSize(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });
});

describe("cropToLasso", () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeCanvas() {
    const calls: string[] = [];
    const context = {
      fillStyle: "",
      fillRect: vi.fn(() => calls.push("fillRect")),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(() => calls.push("clip")),
      drawImage: vi.fn(() => calls.push("drawImage")),
    };
    const blob = new Blob(["j"], { type: "image/jpeg" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => (tag === "canvas" ? canvas : realCreate(tag))) as typeof document.createElement);
    return { canvas, context, blob, calls };
  }

  const image = { width: 4000, height: 3000 } as unknown as HTMLImageElement;

  it("白で塗り、囲みで clip してから描き、JPEG 0.85 で出す", async () => {
    const { canvas, context, blob, calls } = fakeCanvas();
    const result = await cropToLasso(image, [{ x: 100, y: 100 }, { x: 900, y: 100 }, { x: 500, y: 700 }]);
    expect(result).toBe(blob);
    expect(context.fillStyle).toBe("white");
    expect(calls).toEqual(["fillRect", "clip", "drawImage"]);
    expect(context.moveTo).toHaveBeenCalledWith(100, 100);
    expect(context.lineTo).toHaveBeenCalledTimes(2);
    expect(context.closePath).toHaveBeenCalled();
    expect(context.translate).toHaveBeenCalledWith(-100, -100);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.85);
  });

  it("長い辺が 1600 を超えるなら縮める", async () => {
    const { canvas, context } = fakeCanvas();
    await cropToLasso(image, rectPath({ x: 0, y: 0, width: 4000, height: 2000 }));
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(800);
    expect(context.scale).toHaveBeenCalledWith(0.4, 0.4);
  });

  it("写真からはみ出した分は切り落とす", async () => {
    const { canvas } = fakeCanvas();
    await cropToLasso(image, rectPath({ x: -50, y: 2900, width: 500, height: 500 }));
    expect(canvas.width).toBe(450);
    expect(canvas.height).toBe(100);
  });

  it("JPEG にできなければ失敗", async () => {
    const { canvas } = fakeCanvas();
    canvas.toBlob.mockImplementation((cb: (b: Blob | null) => void) => cb(null));
    await expect(cropToLasso(image, rectPath({ x: 0, y: 0, width: 10, height: 10 }))).rejects.toThrow();
  });
});
