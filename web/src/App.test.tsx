import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { MIDWAY_STATE } from "./game/test-state";
import { chaptersOf } from "./data";
import type { GameState } from "./data";
import { displayText } from "./ruby-text";
import { COPY } from "./copy";
import { holdBackWave, isActive } from "./back-wave/back-wave";
import { LOGIN_KEY, MOCK_EMAIL, MOCK_NAME, logOut } from "./login";
import { ACCOUNT_KEY, loadAccount } from "./account";
import { saveGrade5ForTest } from "./test-grade";

// 鳴った効果音を控える（戻る音が1回だけ鳴ることの確認）
const played: string[] = [];
vi.mock("./audio/use-bgm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./audio/use-bgm")>()),
  playSe: (kind: string) => { played.push(kind); },
}));
// ほかの画面は軽い代わりの部品にして、道の配線だけを確かめる
// 学年を変える操作は、島の地図と盤面の代わりの部品にボタンとして置く（学年のえらびは別の部品のため）
vi.mock("./pages/island-map/IslandMapPage", async () => {
  const { useGradeControl } = await import("./grade");
  return {
    IslandMapPage: ({ onEnter, bar }: { onEnter: (id: string) => void; bar?: React.ReactNode }) => {
      const control = useGradeControl();
      return <><h1>island-map</h1>{bar}<button onClick={() => onEnter("kokugo")}>enter-kokugo</button><button onClick={() => control?.setGrade(1)}>set-grade-1</button></>;
    },
  };
});
// 島の地図（/home）の上の帯の入口（D-250）とその下の画面は、サーバを読むので代わりの部品にする
vi.mock("./pages/home/HomeEntries", () => ({
  HomeEntries: ({ onOpen }: { onOpen: (path: string) => void }) => <button data-home-entry="assignments" onClick={() => onOpen("/home/assignments")}>open-assignments</button>,
}));
vi.mock("./pages/home/AssignmentsPage", () => ({
  AssignmentsPage: ({ onGoHome }: { onGoHome: () => void }) => <><p>assignments</p><button onClick={onGoHome}>assignments-home</button></>,
}));
vi.mock("./pages/home/TimetablePage", () => ({
  TimetablePage: ({ onGoHome }: { onGoHome: () => void }) => <><p>timetable</p><button onClick={onGoHome}>timetable-home</button></>,
}));
vi.mock("./pages/print/HandoutPage", () => ({
  HandoutPage: ({ handoutId, classCode }: { handoutId?: string; classCode?: string }) => <p>handout:{handoutId ?? classCode ?? "list"}</p>,
}));
vi.mock("./pages/board/BoardPage", async () => {
  const { useGradeControl } = await import("./grade");
  return {
    BoardPage: ({ game, onOpenChapters }: { game: { state: GameState; chapterProgress: { done: number }; startLesson: (target: { kind: "main"; index: number }) => void }; onOpenChapters: () => void }) => {
      const control = useGradeControl();
      return (
        <><p>board:{game.state.chapterId}</p><p>board-status:{game.chapterProgress.done}:{game.state.xp.kokugo}</p><button onClick={onOpenChapters}>open-chapters</button><button onClick={() => game.startLesson({ kind: "main", index: 0 })}>start-kokugo-lesson</button>
          <button onClick={() => control?.setGrade(1)}>set-grade-1</button><button onClick={() => control?.setGrade(3)}>set-grade-3</button></>
      );
    },
  };
});
// 教科の島は本物を出し、学年を変えるボタンだけ足す（鍵の章しか無い教科の島から学年を変える試験のため）
vi.mock("./pages/subject-island/SubjectIslandPage", async (importOriginal) => {
  const original = await importOriginal<typeof import("./pages/subject-island/SubjectIslandPage")>();
  const { useGradeControl } = await import("./grade");
  return {
    SubjectIslandPage: (props: React.ComponentProps<typeof original.SubjectIslandPage>) => {
      const control = useGradeControl();
      return <><original.SubjectIslandPage {...props} /><button onClick={() => control?.setGrade(1)}>set-grade-1</button><button onClick={() => control?.setGrade(3)}>set-grade-3</button></>;
    },
  };
});
vi.mock("./pages/lesson/TileLessonPage", () => ({
  TileLessonPage: ({ lessonKey }: { lessonKey: string }) => <p>lesson:{lessonKey}</p>,
}));
const STORAGE_KEY = "sugoroku-home-v2";

/** 算数の章えらびは、ほかの教科と同じ教科の島（D-130）。見出しで見分ける */
const isSansuIsland = (): boolean => document.querySelector(".subject-island h1")?.textContent?.includes("算数") ?? false;

function open(path: string, state: Partial<GameState> = {}, loggedIn = true) {
  if (loggedIn) localStorage.setItem(LOGIN_KEY, "Google");
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...MIDWAY_STATE, sansuSelected: true, introSeen: true, ...state }));
  window.history.replaceState(null, "", path);
  return render(<App />);
}

beforeEach(() => { localStorage.clear(); saveGrade5ForTest(); });
afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("画面を移ったときのフォーカス（#371）", () => {
  it("ログイン → ホーム → 島の地図と移るたびに、フォーカスがその画面の見出しへ移る。最初の読み込みでは動かさない", async () => {
    open("/", {}, false);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_786 }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "island-map" })));
  });
});

describe("ログイン画面と道の振り分け（PG-009、D-145、D-146）", () => {
  it("未ログインで / を開くと /login に置き換え、ログイン画面を出す", () => {
    open("/", {}, false);
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(COPY.CP_780);
    expect(screen.queryByText("island-map")).toBeNull();
  });

  it("ボタンを押すと /home へ置き換えて移り、戻るで /login に戻らない", () => {
    open("/", {}, false);
    const before = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_786 }));
    expect(window.location.pathname).toBe("/home");
    expect(window.history.length).toBe(before);
    expect(screen.getByText("island-map")).toBeTruthy();
    expect(localStorage.getItem(LOGIN_KEY)).toBe("Google");
  });

  it("ログイン済みで / や /login を開くと /home へ置き換える", () => {
    open("/");
    expect(window.location.pathname).toBe("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    cleanup();
    open("/login");
    expect(window.location.pathname).toBe("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
  });

  it("未ログインで /home・/map・教科・章・学習の道を開くと /login へ移し、中身は出さない", () => {
    for (const path of ["/home", "/home/timetable", "/map", "/sansu", "/sansu/fraction", "/sansu/lesson/main-3", "/kokugo", "/kokugo/kokugo-kanji-5"]) {
      open(path, {}, false);
      expect(window.location.pathname, path).toBe("/login");
      expect(screen.getByRole("heading", { level: 1 }).textContent, path).toBe(COPY.CP_780);
      expect(screen.queryByText("island-map"), path).toBeNull();
      expect(screen.queryByText(/^board:/), path).toBeNull();
      cleanup();
    }
  });

  it("Classroom の共有リンクは未ログインでも指定した説明を開く", () => {
    open("/home/handouts/h-1", {}, false);
    expect(window.location.pathname).toBe("/home/handouts/h-1");
    expect(screen.getByText("handout:h-1")).toBeTruthy();
  });

  it("学級コードの道（/join/{code}）は未ログインでも、そのコードで開く", () => {
    open("/join/AB23CD", {}, false);
    expect(window.location.pathname).toBe("/join/AB23CD");
    expect(screen.getByText("handout:AB23CD")).toBeTruthy();
  });

  it("ログイン後は元の道へ戻さず /home から始める", () => {
    open("/map", {}, false);
    fireEvent.click(screen.getByRole("button", { name: COPY.CP_787 }));
    expect(window.location.pathname).toBe("/home");
  });

  it("ログアウトで未ログインになると /login へ置き換える", () => {
    open("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    act(() => { logOut(); });
    expect(window.location.pathname).toBe("/login");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(COPY.CP_780);
  });
});

describe("CMP-043 右上の音と顔（D-245、D-246）", () => {
  const text = (value: string) => displayText(value, 5);
  const face = () => screen.queryByRole("button", { name: text(COPY.CP_793) });

  it("子どもの画面（/home と下の画面、島の地図）で、音と顔を1組だけ出す", () => {
    for (const path of ["/home", "/home/assignments", "/home/timetable"]) {
      open(path);
      expect(document.querySelectorAll(".corner"), path).toHaveLength(1);
      expect(document.querySelectorAll(".corner .sound-button"), path).toHaveLength(1);
      expect(document.querySelectorAll(".corner .corner__face"), path).toHaveLength(1);
      expect(face(), path).not.toBeNull();
      cleanup();
    }
  });

  it("ログインの前（/login とログイン前の共有の説明）は音だけで、顔は出さない。顔の場所は空ける", () => {
    for (const path of ["/login", "/home/handouts/h-1", "/join/AB23CD"]) {
      open(path, {}, false);
      expect(document.querySelectorAll(".corner .sound-button"), path).toHaveLength(1);
      expect(face(), path).toBeNull();
      expect(document.querySelector(".corner .corner__face-space"), path).not.toBeNull();
      cleanup();
    }
  });

  it("画面を移っても、同じ組を使い続ける（描き直さない）", () => {
    open("/home");
    const corner = document.querySelector(".corner");
    fireEvent.click(screen.getByRole("button", { name: "open-assignments" }));
    expect(screen.getByText("assignments")).toBeTruthy();
    expect(document.querySelector(".corner")).toBe(corner);
  });

  it("顔を押すとアカウントのパネルが開き、名前・CP-795・ログアウト・とじるが出る。選ぶ音が鳴る", async () => {
    open("/home");
    played.length = 0;
    fireEvent.click(face() as HTMLElement);
    expect(played).toContain("select");
    const dialog = await screen.findByRole("dialog", { name: text(COPY.CP_794) });
    expect(within(dialog).getByText(MOCK_NAME)).not.toBeNull();
    expect(within(dialog).getByText(text(COPY.CP_795("Google", MOCK_EMAIL)))).not.toBeNull();
    expect(within(dialog).getByRole("button", { name: text(COPY.CP_796) })).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: text(COPY.CP_234) })));
  });

  it("「とじる」で閉じ、フォーカスは顔のボタンへ戻る", async () => {
    open("/home");
    const button = face() as HTMLElement;
    button.focus();
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: text(COPY.CP_794) });
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_234) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("「ログアウト」はたしかめを挟み、「ログアウトする」で /login へ移り、音だけになる。失敗したら CP-792 のトースト", async () => {
    open("/home");
    fireEvent.click(face() as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: text(COPY.CP_794) });
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_796) }));
    expect(localStorage.getItem(LOGIN_KEY)).not.toBeNull();

    const failing = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1221) }));
    expect(await screen.findByText(text(COPY.CP_792))).not.toBeNull();
    failing.mockRestore();

    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1221) }));
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(face()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelectorAll(".corner .sound-button")).toHaveLength(1);
  });
});

describe("App の道", () => {
  it("/sansu は算数の教科の島で章をえらぶ（D-130）", () => {
    open("/sansu");
    expect(isSansuIsland()).toBe(true);
  });

  it("記録ありで /sansu/fraction は盤面", () => {
    open("/sansu/fraction");
    expect(screen.getByText("board:fraction")).toBeTruthy();
    expect(window.location.pathname).toBe("/sansu/fraction");
  });

  it("知らない章は /sansu へ移す", () => {
    open("/sansu/nope");
    expect(window.location.pathname).toBe("/sansu");
    expect(isSansuIsland()).toBe(true);
  });

  it("算数の章は順番が無いので、未クリアの章の後ろの章も盤面を開く（D-130、D-133）", () => {
    // 保存の章は分数（未クリア）。その後ろにある、問題のある式の章を直に開く
    open("/sansu/expression");
    expect(window.location.pathname).toBe("/sansu/expression");
    expect(screen.getByText("board:expression")).toBeTruthy();
    expect((JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as GameState).chapterId).toBe("expression");
  });

  it("算数の教科の島で、問題のある章を押すとその章の盤面へ移る（D-133）", () => {
    open("/sansu");
    const expression = chaptersOf(5, "sansu").find((chapter) => chapter.id === "expression")!;
    fireEvent.click(screen.getByRole("button", { name: displayText(expression.title, 5) }));
    expect(window.location.pathname).toBe("/sansu/expression");
    expect(screen.getByText("board:expression")).toBeTruthy();
  });

  it("5年の算数で問題の無い章は、島で鍵の札になり、押すと CP-550 を出して道を変えない。直に開くと /sansu へ戻り、盤面は出ない（D-133）", () => {
    open("/sansu");
    const plane = chaptersOf(5, "sansu").find((chapter) => chapter.id === "plane")!;
    const lockedName = displayText(COPY.CP_207(plane.title), 5);
    const card = screen.getByRole("button", { name: lockedName });
    expect(card.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(card);
    expect(screen.getByRole("status").textContent).toBe(displayText(COPY.CP_550(plane.title), 5));
    expect(window.location.pathname).toBe("/sansu");
    cleanup();
    open("/sansu/plane");
    expect(window.location.pathname).toBe("/sansu");
    expect(isSansuIsland()).toBe(true);
    expect(screen.queryByText(/^board:/)).toBeNull();
  });

  it("開いている別の章は、保存の章をそろえてから盤面を出す", () => {
    open("/sansu/integer");
    expect(window.location.pathname).toBe("/sansu/integer");
    expect(screen.getByText("board:integer")).toBeTruthy();
    expect(screen.queryByText("board:fraction")).toBeNull();
  });

  it("/home は島の地図で、上の帯に App が入口を渡す。古い /map も島の地図を出す（D-250）", () => {
    open("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    expect(screen.getByRole("button", { name: "open-assignments" })).toBeTruthy();
    cleanup();
    open("/map");
    expect(screen.getByText("island-map")).toBeTruthy();
  });

  it("提出物の画面へ移り、ブラウザの戻るで島の地図へ戻る。時間割の画面は「← ホーム」で /home へ戻る（D-136、D-250）", async () => {
    open("/home");
    fireEvent.click(screen.getByRole("button", { name: "open-assignments" }));
    expect(window.location.pathname).toBe("/home/assignments");
    expect(screen.getByText("assignments")).toBeTruthy();
    act(() => {
      window.history.back();
      window.history.replaceState(null, "", "/home");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("island-map")).toBeTruthy();
    cleanup();
    open("/home/timetable");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "timetable-home" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(window.location.pathname).toBe("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    vi.useRealTimers();
  });

  it("知らない道ではファーストディスプレイを出す（道を /home に直すのは main.tsx の resolveInitialPath）", () => {
    open("/nope/where");
    expect(screen.getByText("island-map")).toBeTruthy();
  });

  it("記録なしでは /sansu 以下を /home（島の地図）へ移す", () => {
    open("/sansu/fraction", { sansuSelected: false });
    expect(window.location.pathname).toBe("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
  });

  it("学習の道は App から学習を出す", () => {
    open("/sansu/lesson/main-3");
    expect(screen.getByText("lesson:main-3")).toBeTruthy();
  });

  it("国語の島・章・学習の道は、5年でも6年でも出さない教科なので /home へ移る（FR-011）", () => {
    localStorage.setItem("sugoroku-lesson-resume", JSON.stringify({ "kokugo-kanji-5:main-0": 1 }));
    for (const grade of [5, 6]) {
      for (const path of ["/kokugo", "/kokugo/kokugo-kanji-5", "/kokugo/kokugo-kanji-5/lesson/main-0", "/kokugo/nope"]) {
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade }));
        open(path, { sansuSelected: false });
        expect(window.location.pathname).toBe("/home");
        expect(screen.getByText("island-map")).toBeTruthy();
        cleanup();
      }
    }
    // 保存したデータは消さない
    expect(localStorage.getItem("sugoroku-lesson-resume")).not.toBeNull();
  });

  it("6年で島と道に出すのは算数と理科だけで、国語・生活の道は /home へ移る（FR-011）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 6 }));
    open("/sansu");
    expect(window.location.pathname).toBe("/sansu");
    expect(isSansuIsland()).toBe(true);
    cleanup();
    open("/rika");
    expect(window.location.pathname).toBe("/rika");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("理科");
    cleanup();
    for (const path of ["/kokugo", "/seikatsu"]) {
      open(path);
      expect(window.location.pathname).toBe("/home");
      expect(screen.getByText("island-map")).toBeTruthy();
      cleanup();
    }
  });

  it("1年にすると、実施されない理科の道 /rika は /home へ移る", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 1 }));
    open("/rika");
    expect(window.location.pathname).toBe("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    open("/rika/rika-3-01");
    expect(window.location.pathname).toBe("/home");
  });

  it("生活の島の道 /seikatsu は、1年でも3年でも出さない教科なので /home へ移る（FR-011）", () => {
    for (const grade of [1, 3]) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade }));
      open("/seikatsu");
      expect(window.location.pathname).toBe("/home");
      expect(screen.getByText("island-map")).toBeTruthy();
      cleanup();
    }
  });

  it("3年の理科の島の章札は全部鍵で、押すと CP-550 を出して盤面へ入らない。章の道を直に開くと /rika へ戻る（D-133）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    open("/rika");
    const chapters = chaptersOf(3, "rika");
    chapters.forEach((chapter) => {
      expect(screen.getByRole("button", { name: displayText(COPY.CP_207(chapter.title), 3) }).getAttribute("aria-disabled")).toBe("true");
    });
    const first = chapters[0]!;
    fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_207(first.title), 3) }));
    expect(screen.getByRole("status").textContent).toBe(displayText(COPY.CP_550(first.title), 3));
    expect(window.location.pathname).toBe("/rika");
    expect(screen.queryByText(/^board:/)).toBeNull();
    cleanup();
    open(`/rika/${chapters[1]!.id}`);
    expect(window.location.pathname).toBe("/rika");
    expect(screen.queryByText(/^board:/)).toBeNull();
  });

  it("3年の理科の章の道と学習の道を直に開くと、/rika へ戻る（D-133）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    const first = chaptersOf(3, "rika")[0]!;
    open(`/rika/${first.id}`);
    expect(window.location.pathname).toBe("/rika");
    cleanup();
    open(`/rika/${first.id}/lesson/main-0`);
    expect(window.location.pathname).toBe("/rika");
    expect(screen.queryByText(/^board:/)).toBeNull();
    expect(screen.queryByRole("main", { name: /./ })).toBeNull();
  });

  it("知らない章・別の学年の章は、その教科の章えらびへ移る", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    open("/rika/nope");
    expect(window.location.pathname).toBe("/rika");
    cleanup();
    // 5年の算数の章は、3年の算数では別の学年の章
    open("/sansu/fraction");
    expect(window.location.pathname).toBe("/sansu");
    expect(isSansuIsland()).toBe(true);
  });

  it("問題の無い章の学習の道は、その教科の島へ移る（D-133）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    const first = chaptersOf(3, "rika")[0]!;
    open(`/rika/${first.id}/lesson/main-0`);
    expect(window.location.pathname).toBe("/rika");
    cleanup();
    // 3年の算数には問題が無いので、算数の学習の道も算数の島へ移る
    open("/sansu/lesson/main-0");
    expect(window.location.pathname).toBe("/sansu");
    expect(isSansuIsland()).toBe(true);
    expect(screen.queryByText(/^lesson:/)).toBeNull();
  });

  it("5年の算数で、問題のある章の学習の道は学習を出す。問題の無い章へ保存が向いていても、開いている章へ移る（D-133）", () => {
    open("/sansu/lesson/main-0", { chapterId: "plane" });
    expect(window.location.pathname).toBe("/sansu/lesson/main-0");
    expect(screen.getByText("lesson:main-0")).toBeTruthy();
  });

  describe("学年を変えた時の移し先（FR-002）", () => {
    it("今の教科が新しい学年に無ければ /home へ移す", () => {
      // 3年の理科の章は鍵で盤面に入れないので、理科の島（鍵の章の札が並ぶ）から1年にする
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
      open("/rika");
      fireEvent.click(screen.getByRole("button", { name: "set-grade-1" }));
      expect(window.location.pathname).toBe("/home");
      expect(loadAccount().grade).toBe(1);
    });

    it("今の教科が新しい学年にあれば、その教科の章えらびへ移す", () => {
      open("/sansu/fraction");
      expect(screen.getByText("board:fraction")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "set-grade-3" }));
      expect(window.location.pathname).toBe("/sansu");
      expect(isSansuIsland()).toBe(true);
      cleanup();
      // 理科の章は鍵で盤面に入れないので、理科の島から3年にする（理科は3〜6年にある）
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 5 }));
      open("/rika");
      fireEvent.click(screen.getByRole("button", { name: "set-grade-3" }));
      expect(window.location.pathname).toBe("/rika");
      expect(loadAccount().grade).toBe(3);
    });

    it("/home（島の地図）にいる時は動かさない", () => {
      open("/home");
      fireEvent.click(screen.getByRole("button", { name: "set-grade-1" }));
      expect(window.location.pathname).toBe("/home");
      expect(screen.getByText("island-map")).toBeTruthy();
    });
  });

  it("戻る操作で /home の島の地図から移れる", () => {
    open("/home");
    expect(screen.getByText("island-map")).toBeTruthy();
    act(() => {
      window.history.pushState(null, "", "/sansu");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(isSansuIsland()).toBe(true);
  });

  describe("戻る操作は海の幕か紙の幕を通す（MOT-024、MOT-032、D-251）", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

    it("「章をえらぶ」は波でなく紙の幕（MOT-032、D-251）で、覆った時に /sansu へ移る", async () => {
      const { container } = open("/sansu/fraction");
      played.length = 0;
      fireEvent.click(screen.getByText("open-chapters"));
      expect(container.ownerDocument.querySelector(".back-fade")).not.toBeNull();
      expect(container.ownerDocument.querySelector(".back-wave")).toBeNull();
      expect(played).toEqual(["back"]);
      expect(window.location.pathname).toBe("/sansu/fraction");
      // --duration-normal は 180ms。覆うのは 180ms、消えるのは 360ms
      await advance(140);
      expect(window.location.pathname).toBe("/sansu/fraction");
      await advance(80);
      expect(window.location.pathname).toBe("/sansu");
      await advance(200);
      expect(container.ownerDocument.querySelector(".back-fade")).toBeNull();
    });

    it("「教科をえらぶ」は波が覆った時に /home（島の地図）へ移る（D-250）", async () => {
      open("/sansu");
      fireEvent.click(screen.getByRole("button", { name: displayText(COPY.CP_215, 5) }));
      expect(window.location.pathname).toBe("/sansu");
      // 島の地図の準備を待つ代わりに、ここで保持する。波は覆ったまま待ち、外すと引く（D-141）
      const release = holdBackWave();
      await advance(2000);
      expect(window.location.pathname).toBe("/home");
      expect(screen.getByText("island-map")).toBeTruthy();
      await advance(3000);
      expect(isActive()).toBe(true);
      release();
      await advance(3100);
      expect(isActive()).toBe(false);
    });

    it.each([
      ["/home/assignments", "assignments-home", () => screen.getByRole("button", { name: "open-assignments" }), "PG-007"],
      // 時間割の入口は帯に無い（D-249）ので、地図の見出しへ
      ["/home/timetable", "timetable-home", () => screen.getByRole("heading", { level: 1, name: "island-map" }), "PG-008"],
    ])("「← ホーム」（%s）は波が覆った時に /home（島の地図）へ移り、引いたら押して出てきた入口に focus を置く（D-154、D-250）", async (from, backName, focusTarget, _page) => {
      open(from);
      played.length = 0;
      fireEvent.click(screen.getByRole("button", { name: backName }));
      expect(window.location.pathname).toBe(from);
      expect(isActive()).toBe(true);
      // 戻る音は1回だけ。ボタンの選ぶ音は鳴らさない（D-104）
      expect(played).toEqual(["back"]);
      await advance(1600);
      expect(window.location.pathname).toBe(from);
      await advance(400);
      expect(window.location.pathname).toBe("/home");
      expect(screen.getByText("island-map")).toBeTruthy();
      await advance(1100);
      expect(isActive()).toBe(false);
      expect(document.activeElement).toBe(focusTarget());
    });

    it("ブラウザの戻る（popstate）では波を出さない", () => {
      const { container } = open("/home");
      act(() => {
        window.history.pushState(null, "", "/sansu");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(container.ownerDocument.querySelector(".back-wave")).toBeNull();
      expect(isSansuIsland()).toBe(true);
    });
  });
});

describe("知らない URL（#377）", () => {
  it("知らない道は /home へ戻り、理由を言わずに「そのページは ありません」を 1 回出す", async () => {
    open("/foo");
    await waitFor(() => expect(window.location.pathname).toBe("/home"));
    expect(await screen.findByText(COPY.CP_1279)).toBeTruthy();
  });
});
