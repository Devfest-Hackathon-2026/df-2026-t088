import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGame } from "../../game/use-game";
import { holdLoading, releaseBoot } from "../../loading";
import type { CreateDiorama, DioramaHandle } from "./diorama/engine-api";
import { IslandMapPage } from "./IslandMapPage";

const create = vi.hoisted(() => vi.fn());
// 保持の数を数える。外す関数は1回だけ効く
const holds = vi.hoisted(() => ({ net: 0, calls: 0 }));

vi.mock("../../back-wave/back-wave", () => ({
  holdBackWave: () => {
    holds.calls += 1;
    holds.net += 1;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      holds.net -= 1;
    };
  },
}));

// 読み込み済みの 3D を持っている状態にする
vi.mock("./diorama/use-diorama", async (original) => ({
  ...(await original<typeof import("./diorama/use-diorama")>()),
  hasWebGL2: () => true,
  reducesMotion: () => false,
  cachedDiorama: () => create as unknown as CreateDiorama,
  loadDioramaScene: () => Promise.resolve(create as unknown as CreateDiorama),
}));

function Page({ viaWave, loadDiorama }: { viaWave?: boolean; loadDiorama?: () => Promise<CreateDiorama | null> }) {
  const game = useGame();
  return <IslandMapPage game={game} onEnter={() => {}} viaWave={viaWave} loadDiorama={loadDiorama} />;
}

afterEach(() => {
  holds.net = 0;
  holds.calls = 0;
  vi.useRealTimers();
  document.body.querySelectorAll("#loading").forEach((n) => n.remove());
  localStorage.clear();
});

describe("読み込み済みの 3D を開き直す時", () => {
  it("#loading を出さない", async () => {
    vi.useFakeTimers();
    create.mockReturnValue({ dispose: () => {} } as unknown as DioramaHandle);
    document.body.insertAdjacentHTML("beforeend", '<div id="loading" hidden></div>');
    const el = document.getElementById("loading")!;
    const shown: boolean[] = [];
    new MutationObserver(() => shown.push(!el.hidden)).observe(el, { attributes: true });
    render(<Page />);
    releaseBoot();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(create).toHaveBeenCalled();
    expect(el.hidden).toBe(true);
    expect(shown).not.toContain(true);
    // 保持が残っていないこと
    holdLoading();
    expect(el.hidden).toBe(false);
  });
});

/** #loading の表示の変化を記録する */
function watchLoading() {
  document.body.insertAdjacentHTML("beforeend", '<div id="loading" hidden></div>');
  const el = document.getElementById("loading")!;
  const shown: boolean[] = [];
  new MutationObserver(() => shown.push(!el.hidden)).observe(el, { attributes: true });
  return { el, shown };
}

const never = () => new Promise<CreateDiorama | null>(() => {});

describe("波で開いた時（D-141）", () => {
  it("読み込み中でも #loading を出さず、3D の準備ができるまで波を保持したままにする", async () => {
    vi.useFakeTimers();
    const { el, shown } = watchLoading();
    render(<Page viaWave loadDiorama={never} />);
    releaseBoot();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(el.hidden).toBe(true);
    expect(shown).not.toContain(true);
    expect(holds.net).toBe(1);
  });

  it("波で開いたのでない時は、今までどおり #loading を出す", async () => {
    vi.useFakeTimers();
    const { el } = watchLoading();
    render(<Page loadDiorama={never} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(el.hidden).toBe(false);
    expect(holds.calls).toBe(0);
  });

  it("3D の準備ができたら波を解放する（読み込み済みでも作り終えるまでは待つ）", async () => {
    vi.useFakeTimers();
    create.mockReturnValue({ dispose: () => {} } as unknown as DioramaHandle);
    render(<Page viaWave />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(create).toHaveBeenCalled();
    expect(holds.calls).toBeGreaterThan(0);
    expect(holds.net).toBe(0);
  });

  it("10秒で3D ができなければ平面の地図にして波を解放する", async () => {
    vi.useFakeTimers();
    render(<Page viaWave loadDiorama={never} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(9000); });
    expect(holds.net).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(holds.net).toBe(0);
    expect(document.querySelectorAll(".island").length).toBeGreaterThan(0);
  });

  it("待っている途中で閉じても波を解放する", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<Page viaWave loadDiorama={never} />);
    expect(holds.net).toBe(1);
    unmount();
    expect(holds.net).toBe(0);
  });

  it("StrictMode の二重実行でも、正味1つの保持が残り、閉じると外れる", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<StrictMode><Page viaWave loadDiorama={never} /></StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(holds.calls).toBeGreaterThanOrEqual(2);
    expect(holds.net).toBe(1);
    unmount();
    expect(holds.net).toBe(0);
  });

  it("StrictMode でも、10秒で平面にして保持を外す", async () => {
    vi.useFakeTimers();
    render(<StrictMode><Page viaWave loadDiorama={never} /></StrictMode>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_500); });
    expect(holds.net).toBe(0);
  });
});
