import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toast } from "../../components/Toast";
import { COPY } from "../../copy";
import { ACCOUNT_KEY } from "../../account";
import { savePhoto } from "../../photo";
import { GradeProvider, useGradeControl } from "../../grade";
import { plainText } from "../../ruby-text";
import { SUBJECTS } from "../../data";
import { useGame } from "../../game/use-game";
import { releaseBoot } from "../../loading";
import { islandRouteOf } from "./IslandPaths";
import type { SubjectId } from "../../data";
import type { CreateDiorama, DioramaHandle, DioramaOptions, IslandAnchor } from "./diorama/engine-api";
import type { MapArea } from "./diorama/layout";
import { IslandMapPage } from "./IslandMapPage";
import { playSe } from "../../audio/use-bgm";

// 鳴らした効果音の種類だけを記録する（D-90、D-101）
vi.mock("../../audio/use-bgm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../audio/use-bgm")>()),
  playSe: vi.fn(),
}));

/** 学年のえらびは島の地図に無いので、学年を替える操作はテストの外側のボタンに置く */
function SetGrade() {
  const control = useGradeControl();
  return <>{[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" onClick={() => control?.setGrade(n as 1 | 2 | 3 | 4 | 5 | 6)}>{`set-grade-${n}`}</button>)}</>;
}

function Harness({ onEnter, loadDiorama, startSubject, startArea, grade = 6, bar }: {
  onEnter: (id: SubjectId) => void;
  loadDiorama?: () => Promise<CreateDiorama | null>;
  startSubject?: SubjectId;
  startArea?: MapArea;
  /** その学年から始める（端末に残る学年を先に決める）。渡さない時は 6年（本番の学年）。9島が出て、算数・理科だけ開き、ほかは鍵（FR-011、FR-012） */
  grade?: number;
  bar?: React.ReactNode;
}) {
  const game = useGame();
  withGrade(grade);
  const page = (
    <>
      <IslandMapPage game={game} onEnter={onEnter} loadDiorama={loadDiorama} startSubject={startSubject} startArea={startArea} bar={bar} />
      <Toast toast={game.toast} />
    </>
  );
  return <GradeProvider>{page}<SetGrade /></GradeProvider>;
}

/** 学年をアカウントに残してから描く */
const withGrade = (grade: number) => localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade }));

// 6年は9島。海に国語・算数・理科・社会・英語、高原に音楽・体育・図工・家庭（FR-011）
const SEA_COUNT = 5;
const LAND_COUNT = 4;
const SEA_IDS = ["kokugo", "sansu", "rika", "shakai", "eigo"];
const LAND_IDS = ["ongaku", "taiiku", "zuko", "katei"];
const LOCKED_SEA_IDS = ["kokugo", "shakai", "eigo"];

afterEach(() => {
  vi.mocked(playSe).mockClear();
  vi.useRealTimers();
  localStorage.clear();
});

describe("IslandMapPage", () => {
  it("見出しは出さず、上の帯には渡された入口だけが並ぶ。「← ホーム」・音・学年のえらびは無い（D-144、D-147、D-245、D-250）", () => {
    const onEntry = vi.fn();
    render(<Harness onEnter={() => {}} bar={<button type="button" onClick={onEntry}>entry</button>} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    const bar = document.querySelector(".island-map__bar")!;
    const entry = screen.getByRole("button", { name: "entry" });
    expect(bar.contains(entry)).toBe(true);
    expect(screen.queryByRole("button", { name: plainText(COPY.CP_760) })).toBeNull();
    expect(bar.querySelector(".island-map__grade")).toBeNull();
    expect(bar.querySelector(".sound-button, .sound-control")).toBeNull();
    fireEvent.click(entry);
    expect(onEntry).toHaveBeenCalledTimes(1);
  });

  it("6年（本番の学年）は9島を出し、算数と理科だけ開く。ほかの7島は鍵（FR-011）", () => {
    render(<Harness onEnter={() => {}} />);
    expect(flatNames()).toEqual(SEA_IDS);
    fireEvent.click(gate());
    expect(flatNames()).toEqual(LAND_IDS);
    for (const id of [...SEA_IDS, ...LAND_IDS]) {
      const island = document.querySelector<HTMLElement>(`.island[data-subject="${id}"]`);
      if (!island) fireEvent.click(gate());
      const el = document.querySelector<HTMLElement>(`.island[data-subject="${id}"]`)!;
      const open = id === "sansu" || id === "rika";
      expect(el.classList.contains("island--locked")).toBe(!open);
      expect(el.getAttribute("aria-disabled")).toBe(open ? null : "true");
      expect((el as HTMLButtonElement).disabled).toBe(false);
      expect(el.querySelector(".island__lock") !== null).toBe(!open);
    }
  });

  it("鍵の島は CP_005 の名前で、レベルもアバターも出さない。開く島は鍵もアバターもレベルも通常どおり（FR-011）", () => {
    render(<Harness onEnter={() => {}} />);
    for (const id of LOCKED_SEA_IDS) {
      const el = document.querySelector<HTMLElement>(`.island[data-subject="${id}"]`)!;
      const name = SUBJECTS.find((s) => s.id === id)!.name;
      expect(el.getAttribute("aria-label")).toBe(plainText(COPY.CP_005(name)));
      expect(el.querySelector(".island__lock")).not.toBeNull();
      expect(el.querySelector(".island__level, .island__avatar")).toBeNull();
    }
    const sansu = document.querySelector<HTMLElement>('.island[data-subject="sansu"]')!;
    expect(sansu.classList.contains("island--open")).toBe(true);
    expect(sansu.querySelector(".island__lock")).toBeNull();
    expect(sansu.querySelector(".island__level, .island__avatar")).not.toBeNull();
  });

  it("アバターで選んだポーズ（手を上げる）とかお（ウィンク）を、島の棒人間に出す", () => {
    render(<Harness onEnter={() => {}} />);
    // Harness の描画で学年が書かれるので、写真はその後に保存して描き直す
    act(() => {
      savePhoto({ pose: "wave", face: "wink", bg: "grid", frame: "none", stamp: "none", gear: [] });
    });
    const figure = document.querySelector<HTMLElement>('.island[data-subject="sansu"] .island__avatar')!;
    const drawn = Array.from(figure.querySelectorAll("path")).map((p) => p.getAttribute("d") ?? "");
    expect(drawn.some((d) => d.includes("l12-4 6-10"))).toBe(true); // wave の右腕
    expect(drawn.some((d) => d.includes("M43 27h6"))).toBe(true); // wink の右目
  });

  it("6年は高原に鍵の島が4つ出るので、「高原へ行く」の門も矢印も出る（FR-011、D-150）", () => {
    render(<Harness onEnter={() => {}} />);
    const gate = screen.getByRole("button", { name: plainText(COPY.CP_008) });
    expect(gate.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("平面の地図も場所を押して移り、一度に見せるのは片方だけ", () => {
    render(<Harness onEnter={() => {}} />);
    expect(document.querySelectorAll(".island")).toHaveLength(SEA_COUNT);
    expect(screen.queryByRole("button", { name: /^音楽/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_008) }));
    expect(document.querySelectorAll(".island")).toHaveLength(LAND_COUNT);
    expect(screen.getByRole("button", { name: plainText(COPY.CP_005("音楽")) })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_009) }));
    expect(document.querySelectorAll(".island")).toHaveLength(SEA_COUNT);
  });

  it("鍵の島（国語）を押すと、鍵の音とトーストを出し、入らず、アバターも動かさない（FR-011）", () => {
    vi.useFakeTimers();
    const onEnter = vi.fn();
    render(<Harness onEnter={onEnter} />);
    fireEvent.click(document.querySelector('.island[data-subject="kokugo"]')!);
    expect(vi.mocked(playSe).mock.calls).toEqual([["locked"]]);
    const toast = screen.getByRole("status");
    expect(toast.classList.contains("is-shown")).toBe(true);
    expect(toast.textContent).toBe(plainText(COPY.CP_004("国語")));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onEnter).not.toHaveBeenCalled();
    expect(document.querySelector(".island.is-hopping")).toBeNull();
    expect(document.querySelector('.island[data-subject="sansu"] .island__avatar')).not.toBeNull();
    expect(document.querySelector('.island[data-subject="kokugo"] .island__avatar')).toBeNull();
  });

  it("算数を押すと、跳ねた後に onEnter を1回だけ呼ぶ", () => {
    vi.useFakeTimers();
    const onEnter = vi.fn();
    render(<Harness onEnter={onEnter} />);
    const island = screen.getByRole("button", { name: /^算数 Lv\.\d+$/ });
    fireEvent.click(island);
    fireEvent.click(island);
    expect(onEnter).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("算数を押すと選んだ音、入る時に決定の音を1回ずつ鳴らす（D-101）", () => {
    vi.useFakeTimers();
    render(<Harness onEnter={() => {}} />);
    const island = screen.getByRole("button", { name: /^算数 Lv\.\d+$/ });
    fireEvent.click(island);
    fireEvent.click(island);
    expect(vi.mocked(playSe).mock.calls).toEqual([["tap"]]);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(vi.mocked(playSe).mock.calls).toEqual([["tap"], ["enter"]]);
  });

  it("理科の島も開き、鍵の音もトーストも出さずに、押すと理科で onEnter を呼ぶ（D-117）", () => {
    vi.useFakeTimers();
    const onEnter = vi.fn();
    render(<Harness onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: /^理科 Lv\.\d+$/ }));
    expect(screen.getByRole("status").classList.contains("is-shown")).toBe(false);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(vi.mocked(playSe).mock.calls).toEqual([["tap"], ["enter"]]);
    expect(onEnter).toHaveBeenCalledWith("rika");
  });
});

// 偽のエンジン。zoomTo は test 側で解決する
function fakeEngine() {
  let options: DioramaOptions | undefined;
  let resolveZoom: () => void = () => {};
  const handle = {
    zoomTo: vi.fn(() => new Promise<void>((resolve) => { resolveZoom = resolve; })),
    showArea: vi.fn(() => new Promise<void>((resolve) => { resolveZoom = resolve; })),
    peek: vi.fn(),
    setHighlight: vi.fn(),
    dispose: vi.fn(),
  } satisfies DioramaHandle;
  const create: CreateDiorama = vi.fn((o: DioramaOptions) => {
    options = o;
    return handle;
  });
  return { create, handle, options: () => options!, resolveZoom: () => resolveZoom() };
}

const tags = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".island-tag"));
const tag = (id: string) => document.querySelector<HTMLButtonElement>(`.island-tag[data-subject="${id}"]`)!;
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(500); });

describe("IslandMapPage の 3D", () => {
  async function mount(engine = fakeEngine(), onEnter = vi.fn(), start: { startSubject?: SubjectId; startArea?: MapArea } = {}) {
    vi.useFakeTimers();
    const view = render(<Harness onEnter={onEnter} loadDiorama={async () => engine.create} {...start} />);
    expect(tags()).toHaveLength(0);
    await settle();
    return { engine, onEnter, view };
  }

  it("読み込み後に付箋が出て、見出しは出さない", async () => {
    await mount();
    expect(tags().map((t) => t.dataset.subject)).toEqual(SEA_IDS);
    expect(document.querySelectorAll(".island")).toHaveLength(0);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(document.querySelector("canvas")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("理科の付箋でも理科へ寄り、紙が出た後に理科で onEnter を呼ぶ（D-91）", async () => {
    const { engine, onEnter } = await mount();
    fireEvent.click(tag("rika"));
    expect(engine.handle.peek).not.toHaveBeenCalled();
    expect(engine.handle.zoomTo).toHaveBeenCalledWith("rika");
    engine.resolveZoom();
    await settle();
    fireEvent.animationEnd(document.querySelector(".island-map__paper")!);
    await settle();
    expect(onEnter).toHaveBeenCalledWith("rika");
  });

  it("3D の付箋は鍵の見た目で出す。開くのは算数と理科だけ（FR-011）", async () => {
    await mount();
    for (const id of LOCKED_SEA_IDS) {
      const el = tag(id);
      expect(el.classList.contains("island-tag--locked")).toBe(true);
      expect(el.classList.contains("island-tag--open")).toBe(false);
      expect(el.getAttribute("aria-disabled")).toBe("true");
      const name = SUBJECTS.find((s) => s.id === id)!.name;
      expect(el.getAttribute("aria-label")).toBe(plainText(COPY.CP_005(name)));
      expect(el.querySelector(".island-tag__lock")).not.toBeNull();
      expect(el.querySelector(".island-tag__level")).toBeNull();
    }
    for (const id of ["sansu", "rika"]) {
      expect(tag(id).classList.contains("island-tag--open")).toBe(true);
      expect(tag(id).querySelector(".island-tag__lock")).toBeNull();
    }
  });

  it("鍵の付箋を押すと、鍵の音・トースト・peek。zoomTo も onEnter も呼ばず、アバターも動かさない（FR-011）", async () => {
    const { engine, onEnter } = await mount();
    sendAnchors(engine);
    fireEvent.click(tag("kokugo"));
    expect(vi.mocked(playSe).mock.calls).toEqual([["locked"]]);
    expect(engine.handle.peek).toHaveBeenCalledWith("kokugo");
    expect(engine.handle.zoomTo).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe(plainText(COPY.CP_004("国語")));
    expect(avatarX()).toBe(xOf("sansu"));
    expect(tag("kokugo").classList.contains("is-moving")).toBe(false);
    engine.resolveZoom();
    await settle();
    expect(onEnter).not.toHaveBeenCalled();
    expect(document.querySelector(".island-map__paper")).toBeNull();
  });

  it("模型には9島を渡し、開くのは算数と理科だけ（FR-011）", async () => {
    const { engine } = await mount();
    const islands = engine.options().islands;
    expect(islands.map((i) => i.id)).toHaveLength(9);
    expect(islands.filter((i) => i.open).map((i) => i.id)).toEqual(["sansu", "rika"]);
  });

  it("高原へ行くと showArea が1回呼ばれ、付箋が高原の鍵の4島に替わり、戻れる", async () => {
    const { engine } = await mount();
    const gate = screen.getByRole("button", { name: plainText(COPY.CP_008) });
    fireEvent.click(gate);
    fireEvent.click(gate);
    expect(engine.handle.showArea).toHaveBeenCalledTimes(1);
    expect(engine.handle.showArea).toHaveBeenCalledWith("highland");
    expect(tags().map((t) => t.dataset.subject)).toEqual(LAND_IDS);
    expect(tags().every((t) => t.classList.contains("island-tag--locked"))).toBe(true);
    expect(tag("ongaku").classList.contains("is-moving")).toBe(true);
    engine.resolveZoom();
    await settle();
    expect(tag("ongaku").classList.contains("is-moving")).toBe(false);
    expect(document.querySelector(".diorama-layer__avatar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_009) }));
    expect(engine.handle.showArea).toHaveBeenLastCalledWith("sea");
    expect(tags()).toHaveLength(SEA_COUNT);
  });

  // 島ごとに違う位置を渡し、アバターがどの島に立っているかを位置で見分ける
  const sendAnchors = (engine: ReturnType<typeof fakeEngine>) => {
    const anchors: IslandAnchor[] = SUBJECTS.map((s, i) => ({ id: s.id, x: 100 + i * 10, y: 50, scale: 1 }));
    act(() => engine.options().onAnchors(anchors));
  };
  const avatarX = () => {
    const el = document.querySelector<HTMLElement>(".diorama-layer__avatar");
    return el?.style.transform.match(/translate\((\d+)px/)?.[1];
  };
  const xOf = (id: SubjectId) => String(100 + SUBJECTS.findIndex((s) => s.id === id) * 10);

  it("アバターは算数に固定されず、押した島へ移る", async () => {
    const { engine } = await mount();
    sendAnchors(engine);
    expect(avatarX()).toBe(xOf("sansu"));
    fireEvent.click(tag("rika"));
    expect(avatarX()).toBe(xOf("rika"));
  });

  it("高原の鍵の島から戻る指定（startSubject が鍵）でも、アバターは算数に立つ（FR-011）", async () => {
    const { engine } = await mount(fakeEngine(), vi.fn(), { startSubject: "ongaku", startArea: "highland" });
    sendAnchors(engine);
    expect(tags().map((t) => t.dataset.subject)).toEqual(LAND_IDS);
    expect(document.querySelector(".diorama-layer__avatar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: plainText(COPY.CP_009) }));
    expect(avatarX()).toBe(xOf("sansu"));
  });

  it("3D で右奥の陸地を押すと高原へ移る", async () => {
    const { engine } = await mount();
    act(() => engine.options().onAreaPress("highland"));
    expect(engine.handle.showArea).toHaveBeenCalledWith("highland");
  });

  it("算数の付箋で zoomTo が1回、解決後に onEnter が1回（二度押ししても）", async () => {
    const { engine, onEnter } = await mount();
    fireEvent.click(tag("sansu"));
    fireEvent.click(tag("sansu"));
    expect(engine.handle.zoomTo).toHaveBeenCalledTimes(1);
    expect(tag("sansu").classList.contains("is-moving")).toBe(true);
    expect(onEnter).not.toHaveBeenCalled();
    engine.resolveZoom();
    await settle();
    expect(document.querySelector(".island-map__paper")).not.toBeNull();
    fireEvent.animationEnd(document.querySelector(".island-map__paper")!);
    await settle();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playSe).mock.calls).toEqual([["tap"], ["enter"]]);
  });

  it("zoomTo 解決前に unmount すると onEnter は呼ばれない", async () => {
    const { engine, onEnter, view } = await mount();
    fireEvent.click(tag("sansu"));
    view.unmount();
    expect(engine.handle.dispose).toHaveBeenCalled();
    engine.resolveZoom();
    await settle();
    expect(onEnter).not.toHaveBeenCalled();
    expect(vi.mocked(playSe).mock.calls).toEqual([["tap"]]);
  });

  it("onContextLost で平面へ戻る", async () => {
    const { engine } = await mount();
    act(() => engine.options().onContextLost());
    expect(tags()).toHaveLength(0);
    expect(document.querySelectorAll(".island")).toHaveLength(SEA_COUNT);
    expect(engine.handle.dispose).toHaveBeenCalled();
  });

  it("zoom 中に onContextLost になっても onEnter は1回だけ", async () => {
    const { engine, onEnter } = await mount();
    fireEvent.click(tag("sansu"));
    act(() => engine.options().onContextLost());
    engine.resolveZoom();
    await settle();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("付箋の位置は onAnchors で直接書かれる", async () => {
    const { engine } = await mount();
    act(() => engine.options().onAnchors([{ id: "sansu", x: 100, y: 200, scale: 1 }]));
    expect(tag("sansu").style.transform).toBe("translate(100px, 200px) translate(-50%, -100%)");
  });

  it("読み込み中は上の帯だけで、平面の地図も場所を移るボタンも出さない（D-149）", async () => {
    vi.useFakeTimers();
    const engine = fakeEngine();
    let finishLoad: (c: CreateDiorama) => void = () => {};
    render(<Harness onEnter={() => {}} bar={<button type="button">entry</button>} loadDiorama={() => new Promise<CreateDiorama>((r) => { finishLoad = r; })} />);
    await settle();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(document.querySelector(".island-map__bar")).not.toBeNull();
    expect(screen.getByRole("button", { name: "entry" })).toBeTruthy();
    expect(document.querySelector(".island-map__gate")).toBeNull();
    expect(document.querySelectorAll(".island")).toHaveLength(0);
    await act(async () => { finishLoad(engine.create); });
    await settle();
    expect(tags()).toHaveLength(SEA_COUNT);
    expect(document.querySelectorAll(".island")).toHaveLength(0);
  });

  it("読み込み失敗や createDiorama の例外で平面のまま", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<Harness onEnter={() => {}} loadDiorama={() => Promise.reject(new Error("x"))} />);
    await settle();
    expect(tags()).toHaveLength(0);
    expect(document.querySelectorAll(".island")).toHaveLength(SEA_COUNT);
    unmount();

    render(<Harness onEnter={() => {}} loadDiorama={async () => () => { throw new Error("x"); }} />);
    await settle();
    expect(tags()).toHaveLength(0);
    expect(document.querySelectorAll(".island")).toHaveLength(SEA_COUNT);
  });
});

describe("IslandMapPage の読み込み", () => {
  const flat = () => document.querySelector(".island-map__field");
  const loadingEl = () => document.getElementById("loading")!;

  afterEach(() => {
    document.body.querySelectorAll("#loading").forEach((n) => n.remove());
  });

  it("10秒で届かないと平面の地図へ替わり、その後に解決しても 3D を出さない", async () => {
    vi.useFakeTimers();
    let resolve: (c: CreateDiorama | null) => void = () => {};
    const engine = fakeEngine();
    render(<Harness onEnter={() => {}} loadDiorama={() => new Promise((r) => { resolve = r; })} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(flat()).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(flat()).not.toBeNull();
    await act(async () => { resolve(engine.create); await vi.advanceTimersByTimeAsync(500); });
    expect(document.querySelector("canvas")).toBeNull();
    expect(engine.create).not.toHaveBeenCalled();
  });

  it("読み込み中は #loading を保持し、3D の準備ができたら解放する", async () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML("beforeend", '<div id="loading"></div>');
    const engine = fakeEngine();
    let resolve: (c: CreateDiorama | null) => void = () => {};
    render(<Harness onEnter={() => {}} loadDiorama={() => new Promise((r) => { resolve = r; })} />);
    releaseBoot();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(loadingEl().hidden).toBe(false);
    await act(async () => { resolve(engine.create); await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(loadingEl().hidden).toBe(true);
  });

  it("unmount の後にタイマーが残らない", async () => {
    vi.useFakeTimers();
    const view = render(<Harness onEnter={() => {}} loadDiorama={() => new Promise(() => {})} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(vi.getTimerCount()).toBe(0);
  });
});

// 学年ごとの島（FR-001、FR-002、FR-009）
const flatNames = () => Array.from(document.querySelectorAll<HTMLElement>(".island")).map((el) => el.dataset.subject);
// 学年で文字が漢字かかなに変わるので、門は名前では探さない
const gate = () => document.querySelector<HTMLElement>(".island-map__gate")!;
const chooseGrade = (grade: number) => fireEvent.click(screen.getByRole("button", { name: `set-grade-${grade}` }));

describe("IslandMapPage の学年", () => {
  const allFlat = () => {
    const sea = flatNames();
    const hasGate = document.querySelector(".island-map__gate") !== null;
    if (hasGate) fireEvent.click(gate());
    const land = hasGate ? flatNames() : [];
    if (hasGate) fireEvent.click(gate());
    return [...sea, ...land];
  };
  const lockedIds = () => Array.from(document.querySelectorAll<HTMLElement>(".island--locked")).map((el) => el.dataset.subject);

  it("1年は国語・算数・生活・音楽・体育・図工の6島を出し、開くのは算数だけ。理科は実施されず出さない（FR-011）", () => {
    render(<Harness onEnter={() => {}} grade={1} />);
    expect(flatNames()).toEqual(["kokugo", "sansu", "seikatsu"]);
    expect(lockedIds()).toEqual(["kokugo", "seikatsu"]);
    expect(allFlat()).toEqual(["kokugo", "sansu", "seikatsu", "ongaku", "taiiku", "zuko"]);
    expect(document.querySelector('.island[data-subject="sansu"]')?.classList.contains("island--open")).toBe(true);
    // 道は国語→算数→生活の順に島の中心を回る輪（#185）
    expect(islandRouteOf(["kokugo", "sansu", "seikatsu"])).toEqual([[50, 16.7], [16.7, 50], [50, 83.3]]);
    expect(document.querySelector(".island-paths path")?.getAttribute("d") ?? "").not.toBe("");
  });

  it("3年は8島（生活なし）、5年と6年は9島。開くのは算数と理科だけ（FR-011）", () => {
    for (const [grade, count] of [[3, 8], [5, 9], [6, 9]] as const) {
      const view = render(<Harness onEnter={() => {}} grade={grade} />);
      const ids = allFlat();
      expect(ids).toHaveLength(count);
      expect(ids).not.toContain("seikatsu");
      const open = Array.from(document.querySelectorAll<HTMLElement>(".island--open")).map((el) => el.dataset.subject);
      expect(open).toEqual(["sansu", "rika"]);
      view.unmount();
    }
  });

  it("島の地図に学年のえらびは無く、学年を変えると島がその場で変わる（D-144）", () => {
    render(<Harness onEnter={() => {}} grade={5} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(flatNames()).toHaveLength(5);
    chooseGrade(1);
    expect(flatNames()).toEqual(["kokugo", "sansu", "seikatsu"]);
    chooseGrade(4);
    expect(flatNames()).toEqual(["kokugo", "sansu", "rika", "shakai", "eigo"]);
  });

  it("開く島（算数・理科）は鍵のトーストなしで onEnter を呼び、ほかの島は鍵の音とトーストで onEnter を呼ばない", () => {
    vi.useFakeTimers();
    for (const grade of [1, 3, 5, 6]) {
      const first = render(<Harness onEnter={() => {}} grade={grade} />);
      const ids = allFlat();
      first.unmount();
      for (const id of ids) {
        vi.mocked(playSe).mockClear();
        const onEnter = vi.fn();
        const view = render(<Harness onEnter={onEnter} grade={grade} />);
        if (!document.querySelector(`.island[data-subject="${id}"]`)) fireEvent.click(gate());
        vi.mocked(playSe).mockClear();
        fireEvent.click(document.querySelector(`.island[data-subject="${id}"]`)!);
        const toastShown = screen.getByRole("status").classList.contains("is-shown");
        act(() => { vi.advanceTimersByTime(1000); });
        if (id === "sansu" || id === "rika") {
          expect(toastShown).toBe(false);
          expect(onEnter).toHaveBeenCalledWith(id);
        } else {
          expect(toastShown).toBe(true);
          expect(vi.mocked(playSe).mock.calls).toEqual([["locked"]]);
          expect(onEnter).not.toHaveBeenCalled();
        }
        view.unmount();
      }
    }
  });
});

describe("IslandMapPage の3Dの学年", () => {
  const mountGrade = async (grade: number, start: { startSubject?: SubjectId } = {}) => {
    withGrade(grade);
    vi.useFakeTimers();
    const engine = fakeEngine();
    const view = render(<Harness onEnter={() => {}} loadDiorama={async () => engine.create} grade={grade} {...start} />);
    await settle();
    return { engine, view };
  };
  const shownIds = (engine: ReturnType<typeof fakeEngine>) => engine.options().islands.map((i) => i.id);

  it("模型にも付箋にも、学年の教科を渡す。1年は生活あり・理科なしで、開くのは算数だけ（FR-011）", async () => {
    const { engine } = await mountGrade(1);
    expect(shownIds(engine)).toEqual(["kokugo", "sansu", "ongaku", "taiiku", "zuko", "seikatsu"].sort((a, b) => SUBJECTS.findIndex((s) => s.id === a) - SUBJECTS.findIndex((s) => s.id === b)));
    expect(engine.options().islands.filter((i) => i.open).map((i) => i.id)).toEqual(["sansu"]);
    expect(tags().map((t) => t.dataset.subject)).toEqual(["kokugo", "sansu", "seikatsu"]);
    expect(document.querySelectorAll(".island-tag--locked")).toHaveLength(2);
    expect(document.querySelectorAll(".island-tag--open")).toHaveLength(1);
  });

  it("3年は8島、5年と6年は9島。開くのは算数と理科だけ", async () => {
    for (const [grade, count] of [[3, 8], [5, 9], [6, 9]] as const) {
      const view = await mountGrade(grade);
      expect(shownIds(view.engine)).toHaveLength(count);
      expect(view.engine.options().islands.filter((i) => i.open).map((i) => i.id)).toEqual(["sansu", "rika"]);
      view.view.unmount();
    }
  });

  it("学年を変えると、模型を作り直して島が変わる", async () => {
    const { engine } = await mountGrade(5);
    expect(tags()).toHaveLength(5);
    chooseGrade(2);
    await settle();
    expect(engine.create).toHaveBeenCalledTimes(2);
    expect(engine.handle.dispose).toHaveBeenCalledTimes(1);
    expect(shownIds(engine)).toContain("seikatsu");
    expect(shownIds(engine)).not.toContain("rika");
    expect(tags().map((t) => t.dataset.subject)).toEqual(["kokugo", "sansu", "seikatsu"]);
  });

  it("生活の付箋は鍵で、押すと生活へ寄らず peek とトーストを出す（FR-011）", async () => {
    const { engine } = await mountGrade(1);
    fireEvent.click(tag("seikatsu"));
    expect(engine.handle.zoomTo).not.toHaveBeenCalled();
    expect(engine.handle.peek).toHaveBeenCalledWith("seikatsu");
    expect(screen.getByRole("status").classList.contains("is-shown")).toBe(true);
  });

  it("理科の付箋を押すと理科へ寄って、鍵のトーストを出さない", async () => {
    const { engine } = await mountGrade(5);
    fireEvent.click(tag("rika"));
    expect(engine.handle.zoomTo).toHaveBeenCalledWith("rika");
    expect(screen.getByRole("status").classList.contains("is-shown")).toBe(false);
  });

  it("立っていた島が今の学年に無い時は、算数に立つ", async () => {
    const { engine } = await mountGrade(1, { startSubject: "rika" });
    act(() => engine.options().onAnchors(SUBJECTS.map((s, i) => ({ id: s.id, x: 100 + i * 10, y: 50, scale: 1 }))));
    expect(document.querySelector<HTMLElement>(".diorama-layer__avatar")?.style.transform.match(/translate\((\d+)px/)?.[1]).toBe(String(100 + SUBJECTS.findIndex((s) => s.id === "sansu") * 10));
  });
});
