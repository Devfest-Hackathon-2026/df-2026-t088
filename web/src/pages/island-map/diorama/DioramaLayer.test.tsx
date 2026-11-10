import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { SUBJECTS } from "../../../data";
import { useGame } from "../../../game/use-game";
import { DioramaLayer } from "./DioramaLayer";
import type { CreateDiorama, DioramaHandle } from "./engine-api";

function makeHandle(ready?: Promise<void>): DioramaHandle {
  return {
    ready,
    zoomTo: () => Promise.resolve(),
    showArea: () => Promise.resolve(),
    peek: () => {},
    setHighlight: () => {},
    dispose: vi.fn(),
  };
}

function setup(create: CreateDiorama) {
  const cb = { onReady: vi.fn(), onFail: vi.fn() };
  const handleRef = createRef<DioramaHandle | null>() as React.MutableRefObject<DioramaHandle | null>;
  handleRef.current = null;
  function Harness() {
    const game = useGame();
    return (
      <DioramaLayer
        create={create}
        game={game}
        subjects={SUBJECTS.slice(0, 2)}
        openIds={SUBJECTS.slice(0, 1).map((s) => s.id)}
        area="sea"
        current={SUBJECTS[0].id}
        moving={false}
        paper={false}
        handleRef={handleRef}
        onReady={cb.onReady}
        onFail={cb.onFail}
        onContextLost={() => {}}
        onPress={() => {}}
        onAreaPress={() => {}}
        onPaperEnd={() => {}}
      />
    );
  }
  const view = render(<Harness />);
  return { ...view, ...cb, handleRef };
}

const flush = () => act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });

describe("DioramaLayer（D-142）", () => {
  it("ready が解決するまで onReady を呼ばず、解決したら呼ぶ", async () => {
    let resolve!: () => void;
    const handle = makeHandle(new Promise<void>((r) => { resolve = r; }));
    const { onReady, onFail, handleRef } = setup(() => handle);
    await flush();
    expect(onReady).not.toHaveBeenCalled();
    expect(handleRef.current).toBeNull();
    await act(async () => { resolve(); });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(handleRef.current).toBe(handle);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("ready を持たない偽の create でも onReady を呼ぶ", async () => {
    const handle = makeHandle();
    const { onReady } = setup(() => handle);
    await flush();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("ready が reject されたら onFail を呼び、onReady は呼ばない", async () => {
    const handle = makeHandle(Promise.reject(new Error("x")));
    const { onReady, onFail } = setup(() => handle);
    await flush();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("組み立て中に片付けられたら、後から ready が解決しても onReady も onFail も呼ばない", async () => {
    let resolve!: () => void;
    const handle = makeHandle(new Promise<void>((r) => { resolve = r; }));
    const { onReady, onFail, unmount, handleRef } = setup(() => handle);
    await flush();
    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); });
    expect(onReady).not.toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
    expect(handleRef.current).toBeNull();
  });

  it("組み立て中に片付けられたあと ready が reject されても onFail を呼ばない", async () => {
    let reject!: (e: unknown) => void;
    const handle = makeHandle(new Promise<void>((_, r) => { reject = r; }));
    const { onFail, unmount } = setup(() => handle);
    await flush();
    unmount();
    await act(async () => { reject(new Error("x")); });
    expect(onFail).not.toHaveBeenCalled();
  });

  it("create が例外を投げたら onFail", async () => {
    const { onReady, onFail } = setup(() => { throw new Error("x"); });
    await flush();
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
  });
});
