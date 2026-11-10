import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarFace } from "../../components/Avatar";
import { COPY } from "../../copy";
import { EQUIPMENT, SUBJECTS } from "../../data";
import { chaptersOf, subjectsOfGrade } from "../../data/courses";
import { subjectLevel } from "../../game/logic";
import { seedMidwayState } from "../../game/test-state";
import { useGame } from "../../game/use-game";
import { saveAccountGrade } from "../../account";
import { GradeProvider } from "../../grade";
import { LOGIN_KEY, MOCK_NAME } from "../../login";
import { DEFAULT_LOOK, loadPhoto, savePhoto } from "../../photo";
import { displayText } from "../../ruby-text";
import { AccountPanel } from "./AccountPanel";

const text = (value: string) => displayText(value, 5);
const SANSU = SUBJECTS.find((subject) => subject.id === "sansu")?.name ?? "";
const gearName = (id: string) => EQUIPMENT.find((item) => item.id === id)?.name ?? "";

function setup() {
  const showToast = vi.fn();
  function Harness() {
    const game = useGame();
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>ひらく</button>
        <AvatarFace />
        <AccountPanel open={open} onClose={() => setOpen(false)} game={game} showToast={showToast} />
      </>
    );
  }
  render(<GradeProvider><Harness /></GradeProvider>);
  return { showToast };
}

async function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "ひらく" }));
  return screen.findByRole("dialog", { name: text(COPY.CP_794) });
}

async function openAvatarTab() {
  const dialog = await openPanel();
  fireEvent.click(within(dialog).getByRole("tab", { name: text(COPY.CP_1132) }));
  return dialog;
}

const choose = (dialog: HTMLElement, kind: string) => fireEvent.click(within(dialog).getByRole("tab", { name: text(kind) }));
const cheki = (dialog: HTMLElement) => (dialog.querySelector(".avatar-photo-cheki") as HTMLElement).innerHTML;

// とる → とったあと（演出を時計で進める）
function shoot(dialog: HTMLElement) {
  vi.useFakeTimers();
  fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1150) }));
  act(() => { vi.advanceTimersByTime(2000); });
  vi.useRealTimers();
}

describe("CMP-028 アカウントのパネル（D-194〜D-201）", () => {
  beforeEach(() => {
    window.localStorage.setItem(LOGIN_KEY, "Google");
    // 5年の算数・国語の学習で確かめる。main で初めの学年が6年になったので、保存の学年を5年にする（FR-012）
    saveAccountGrade(5);
    seedMidwayState();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("開くと「くわしく」から。上に名前・Lv・メーター・とじるが出て、最初のフォーカスは「とじる」", async () => {
    setup();
    const dialog = await openPanel();
    expect(within(dialog).getByRole("tab", { name: text(COPY.CP_1131) }).getAttribute("aria-selected")).toBe("true");
    expect(within(dialog).getByRole("tab", { name: text(COPY.CP_1132) }).getAttribute("aria-selected")).toBe("false");
    expect(within(dialog).getByText(MOCK_NAME)).not.toBeNull();
    expect(within(dialog).getByText(/^アバター Lv\.\d+$/)).not.toBeNull();
    expect(dialog.querySelector(".meter")).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: text(COPY.CP_234) })));
  });

  it("タブは左右の矢印で移り、aria-controls の中身だけが見える", async () => {
    setup();
    const dialog = await openPanel();
    const detail = within(dialog).getByRole("tab", { name: text(COPY.CP_1131) });
    fireEvent.keyDown(detail, { key: "ArrowRight" });
    const avatar = within(dialog).getByRole("tab", { name: text(COPY.CP_1132) });
    expect(avatar.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(avatar);
    expect(avatar.getAttribute("aria-controls")).toBe("account-main-panel-avatar");
    expect(within(dialog).getByRole("tabpanel", { name: text(COPY.CP_1132) })).not.toBeNull();
    expect(within(dialog).queryByRole("tabpanel", { name: text(COPY.CP_1131) })).toBeNull();
    fireEvent.keyDown(avatar, { key: "ArrowLeft" });
    expect(within(dialog).getByRole("tab", { name: text(COPY.CP_1131) }).getAttribute("aria-selected")).toBe("true");
  });

  it("くわしく：学習のある教科だけ行にし、ほかは CP-1135 の1行にする。行は CP-1136 で読む", async () => {
    setup();
    const dialog = await openPanel();
    const rows = within(dialog).getAllByRole("listitem");
    const subjects = subjectsOfGrade(5);
    expect(rows).toHaveLength(2); // 5年は算数と国語に学習がある
    const sansuTotal = chaptersOf(5, "sansu").length;
    // 整数・小数・式のテストをクリア済み（MIDWAY_STATE）
    expect(within(dialog).getByText(text(COPY.CP_1136(SANSU, sansuTotal, 3, subjectLevel(460))))).not.toBeNull();
    expect(within(dialog).getByText(text(COPY.CP_1134(3, sansuTotal)))).not.toBeNull();
    expect(within(dialog).queryByText(text(COPY.CP_1135(subjects.length - 2)))).toBeNull();
    expect(within(dialog).getByText(text(COPY.CP_1133))).not.toBeNull();
  });

  it.each([
    ["保存が無い", () => window.localStorage.removeItem("sugoroku:account")],
    ["保存が壊れている", () => window.localStorage.setItem("sugoroku:account", "{こわれた")],
  ])("くわしく：学年が未設定（%s）で学習が無い学年なら、行の代わりに CP-1137 を出す（#372）", async (_name, unset) => {
    unset();
    setup();
    const dialog = await openPanel();
    expect(within(dialog).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(dialog).getByText(displayText(COPY.CP_1137, 6))).not.toBeNull();
    expect(within(dialog).getByText(displayText(COPY.CP_1133, 6))).not.toBeNull();
  });

  it("くわしく：学習のある学年（5年）なら CP-1137 は出さず、従来どおり2行出す（#372）", async () => {
    setup();
    const dialog = await openPanel();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2);
    expect(within(dialog).queryByText(text(COPY.CP_1137))).toBeNull();
  });

  it("くわしく：ログインを出す。次の装備・はじめからにする・出典のリンクは出さない", async () => {
    setup();
    const dialog = await openPanel();
    expect(within(dialog).queryByText(COPY.CP_202(10, "マント"))).toBeNull();
    expect(within(dialog).queryByRole("button", { name: COPY.CP_216 })).toBeNull();
    expect(within(dialog).getByText(/Google で ログインしています/)).not.toBeNull();
    expect(within(dialog).queryByRole("link")).toBeNull();
  });

  it("そうび：押すと着けはずしが切り替わる。鍵は押せない", async () => {
    setup();
    const dialog = await openAvatarTab();
    const pencil = within(dialog).getByRole("button", { name: text(gearName("pencil")) });
    expect(pencil.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pencil);
    expect(within(dialog).getByRole("button", { name: text(gearName("pencil")) }).getAttribute("aria-pressed")).toBe("false");
    expect(JSON.parse(window.localStorage.getItem("sugoroku-home-v2") ?? "{}").takenOff).toEqual(["pencil"]);
    fireEvent.click(within(dialog).getByRole("button", { name: text(gearName("pencil")) }));
    expect(JSON.parse(window.localStorage.getItem("sugoroku-home-v2") ?? "{}").takenOff).toEqual([]);

    const locked = within(dialog).getByRole("button", { name: `${text(gearName("cape"))}。${text(COPY.CP_308(10))}` });
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    expect(locked.getAttribute("aria-pressed")).toBeNull();
    fireEvent.click(locked);
    expect(JSON.parse(window.localStorage.getItem("sugoroku-home-v2") ?? "{}").takenOff).toEqual([]);
  });

  it("ポーズを選ぶとチェキが変わり、矢印キーでも選べる。選ぶだけでは保存しない", async () => {
    setup();
    const dialog = await openAvatarTab();
    choose(dialog, COPY.CP_1141);
    const group = within(dialog).getByRole("radiogroup", { name: text(COPY.CP_1141) });
    const before = cheki(dialog);
    const stand = within(group).getByRole("radio", { name: COPY.CP_1145.stand });
    expect(stand.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: COPY.CP_1145.wave }));
    expect(within(group).getByRole("radio", { name: COPY.CP_1145.wave }).getAttribute("aria-checked")).toBe("true");
    expect(cheki(dialog)).not.toBe(before);
    fireEvent.keyDown(within(group).getByRole("radio", { name: COPY.CP_1145.wave }), { key: "ArrowRight" });
    expect(within(group).getByRole("radio", { name: COPY.CP_1145.banzai }).getAttribute("aria-checked")).toBe("true");
    expect(loadPhoto()).toBeNull();
  });

  it("かざり：フレームとスタンプの2行。教科の印は算数・国語・理科の時だけ出す", async () => {
    setup();
    const dialog = await openAvatarTab();
    choose(dialog, COPY.CP_1144);
    expect(within(dialog).getAllByRole("radio")).toHaveLength(10);
    const stamps = within(dialog).getByRole("radiogroup", { name: COPY.CP_1149.label });
    expect(within(stamps).getByRole("radio", { name: text(COPY.CP_1149.subject) })).not.toBeNull();
    fireEvent.click(within(stamps).getByRole("radio", { name: COPY.CP_1149.hanamaru }));
    expect(within(stamps).getByRole("radio", { name: COPY.CP_1149.hanamaru }).getAttribute("aria-checked")).toBe("true");
    expect(within(stamps).getByRole("radio", { name: COPY.CP_1149.none }).getAttribute("aria-checked")).toBe("false");
  });

  it("しゃしんを とる → これにする：選び方と着けている装備を保存し、顔のボタンの写真が変わる", async () => {
    const { showToast } = setup();
    const dialog = await openAvatarTab();
    const faceBefore = document.querySelector(".avatar-photo--face")?.innerHTML;
    choose(dialog, COPY.CP_1141);
    fireEvent.click(within(dialog).getByRole("radio", { name: COPY.CP_1145.wave }));
    shoot(dialog);
    // とったあと：種類のタブと候補を隠し、CP-1151 と2つのボタン。フォーカスは「これにする」
    expect(within(dialog).queryByRole("radiogroup")).toBeNull();
    expect(within(dialog).getByText(text(COPY.CP_1151))).not.toBeNull();
    const keep = within(dialog).getByRole("button", { name: COPY.CP_1152 });
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(loadPhoto()).toMatchObject({ pose: "wave", face: "smile", bg: "grid", gear: ["pencil", "hat"] });
    expect(showToast).toHaveBeenCalledWith(text(COPY.CP_1154));
    expect(document.querySelector(".avatar-photo--face")?.innerHTML).not.toBe(faceBefore);
    // ふだんの形に戻り、フォーカスは「しゃしんを とる」
    expect(within(dialog).getByRole("button", { name: text(COPY.CP_1150) })).not.toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: text(COPY.CP_1150) }));
  });

  it("保存に失敗したら CP-1155 を出し、とったあとのまま残す", async () => {
    const { showToast } = setup();
    const dialog = await openAvatarTab();
    shoot(dialog);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(within(dialog).getByRole("button", { name: COPY.CP_1152 }));
    expect(showToast).toHaveBeenCalledWith(text(COPY.CP_1155));
    expect(within(dialog).getByRole("button", { name: COPY.CP_1152 })).not.toBeNull();
  });

  it("とりなおす：選び方を残してふだんの形に戻り、保存はしない。フォーカスは「しゃしんを とる」", async () => {
    setup();
    const dialog = await openAvatarTab();
    choose(dialog, COPY.CP_1142);
    fireEvent.click(within(dialog).getByRole("radio", { name: COPY.CP_1146.wink }));
    shoot(dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: COPY.CP_1153 }));
    expect(loadPhoto()).toBeNull();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: text(COPY.CP_1150) }));
    expect(within(dialog).getByRole("radio", { name: COPY.CP_1146.wink }).getAttribute("aria-checked")).toBe("true");
  });

  it("演出：光ってからせり出す。途中で押すと、とったあとの形へ飛ぶ", async () => {
    setup();
    const dialog = await openAvatarTab();
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1150) }));
    expect(dialog.querySelector(".account-flash")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(150); });
    expect(dialog.querySelector(".account-flash")).toBeNull();
    expect(dialog.querySelector(".account-print")).not.toBeNull();
    fireEvent.click(dialog.querySelector(".account-print") as HTMLElement);
    vi.useRealTimers();
    expect(within(dialog).getByRole("button", { name: COPY.CP_1152 })).not.toBeNull();
    expect(dialog.querySelector(".account-print")).toBeNull();
  });

  it("動きを減らす設定では、光らせず、せり出さず、すぐとったあとの形", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    try {
      setup();
      const dialog = await openAvatarTab();
      fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1150) }));
      expect(dialog.querySelector(".account-flash")).toBeNull();
      expect(dialog.querySelector(".account-print")).toBeNull();
      expect(within(dialog).getByRole("button", { name: COPY.CP_1152 })).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("閉じて開き直すと「くわしく」・そうび・下書きを捨てた形に戻る。保存した写真から始める", async () => {
    setup();
    let dialog = await openAvatarTab();
    choose(dialog, COPY.CP_1141);
    fireEvent.click(within(dialog).getByRole("radio", { name: COPY.CP_1145.jump }));
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_234) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    dialog = await openPanel();
    expect(within(dialog).getByRole("tab", { name: text(COPY.CP_1131) }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(within(dialog).getByRole("tab", { name: text(COPY.CP_1132) }));
    expect(within(dialog).getByRole("tab", { name: text(COPY.CP_1140) }).getAttribute("aria-selected")).toBe("true");
    choose(dialog, COPY.CP_1141);
    expect(within(dialog).getByRole("radio", { name: COPY.CP_1145.stand }).getAttribute("aria-checked")).toBe("true");

    // 保存した写真があれば、その選び方から始める
    savePhoto({ ...DEFAULT_LOOK, pose: "think", gear: [] });
    fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_234) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    dialog = await openAvatarTab();
    choose(dialog, COPY.CP_1141);
    expect(within(dialog).getByRole("radio", { name: COPY.CP_1145.think }).getAttribute("aria-checked")).toBe("true");
  });

  describe("ログアウトのたしかめ（D-220）", () => {
    const logoutRow = (dialog: HTMLElement) => within(dialog).getByRole("button", { name: text(COPY.CP_796) });

    it("「ログアウト」を押すとたしかめに替わり、名前が問いに入り、フォーカスは「やめる」。まだログアウトしていない", async () => {
      setup();
      const dialog = await openPanel();
      fireEvent.click(logoutRow(dialog));
      expect(window.localStorage.getItem(LOGIN_KEY)).not.toBeNull();
      const group = within(dialog).getByRole("group", { name: text(COPY.CP_1220(MOCK_NAME)) });
      expect(group).not.toBeNull();
      expect(within(dialog).queryByRole("button", { name: text(COPY.CP_796) })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(within(group).getByRole("button", { name: text(COPY.CP_243) })));
    });

    it("名前が読めない時は問いが CP-1222", async () => {
      setup();
      const dialog = await openPanel();
      window.localStorage.setItem(LOGIN_KEY, "");
      fireEvent.click(logoutRow(dialog));
      expect(within(dialog).getByRole("group", { name: text(COPY.CP_1222) })).not.toBeNull();
    });

    it("「やめる」でボタンの行に戻り、フォーカスは「ログアウト」へ戻る", async () => {
      setup();
      const dialog = await openPanel();
      fireEvent.click(logoutRow(dialog));
      fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_243) }));
      expect(within(dialog).queryByRole("group")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(logoutRow(dialog)));
      expect(window.localStorage.getItem(LOGIN_KEY)).not.toBeNull();
    });

    it("「ログアウトする」でログアウトする", async () => {
      setup();
      const dialog = await openPanel();
      fireEvent.click(logoutRow(dialog));
      fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1221) }));
      expect(window.localStorage.getItem(LOGIN_KEY)).toBeNull();
    });

    it("失敗したら CP-792 のトーストを出し、たしかめの形のまま残す", async () => {
      const { showToast } = setup();
      const dialog = await openPanel();
      fireEvent.click(logoutRow(dialog));
      const failing = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
      fireEvent.click(within(dialog).getByRole("button", { name: text(COPY.CP_1221) }));
      failing.mockRestore();
      expect(showToast).toHaveBeenCalledWith(text(COPY.CP_792));
      expect(within(dialog).getByRole("group")).not.toBeNull();
    });

    it("アバターのタブに替えて戻ると、ボタンの行に戻っている", async () => {
      setup();
      const dialog = await openPanel();
      fireEvent.click(logoutRow(dialog));
      fireEvent.click(within(dialog).getByRole("tab", { name: text(COPY.CP_1132) }));
      fireEvent.click(within(dialog).getByRole("tab", { name: text(COPY.CP_1131) }));
      expect(within(dialog).queryByRole("group")).toBeNull();
      expect(logoutRow(dialog)).not.toBeNull();
    });
  });

});
