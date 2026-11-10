import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ACCOUNT_KEY } from "../account";
import { GradeProvider } from "../grade";
import { Avatar, AvatarFace } from "./Avatar";
import { Button } from "./Button";
import { Meter } from "./Meter";
import { Panel } from "./Panel";
import { Ruby } from "./Ruby";
import { Toast } from "./Toast";

describe("Ruby", () => {
  it("ふりがなは付けず（ruby にしない）、wbr を残す。学年の外では漢字のまま", () => {
    const { container } = render(<p><Ruby text="[特訓場|とっくんじょう]の<wbr>前" /></p>);
    expect(container.querySelector("ruby")).toBeNull();
    expect(container.textContent).toBe("特訓場の前");
    expect(container.querySelector("wbr")).not.toBeNull();
  });

  it("学年までに習う字だけの語は漢字、そうでなければひらがな", () => {
    const text = "[前|まえ]の[特訓場|とっくんじょう]";
    const show = () => render(<GradeProvider><p><Ruby text={text} /></p></GradeProvider>);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 1 }));
    expect(show().container.textContent).toBe("まえのとっくんじょう");
    cleanup();
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 6 }));
    expect(show().container.textContent).toBe("前の特訓場");
  });
});

describe("Meter", () => {
  it("読み上げの名前を持ち、伸びは transform 用の割合で渡す", () => {
    render(<Meter ratio={0.5} label="算数 レベル5" />);
    const meter = screen.getByRole("img", { name: "算数 レベル5" });
    expect(meter.style.getPropertyValue("--meter-ratio")).toBe("0.5");
  });
});

describe("Button", () => {
  it("種類をクラスで持ち、type は button", () => {
    render(<Button variant="primary">はじめる</Button>);
    const button = screen.getByRole("button", { name: "はじめる" });
    expect(button.className).toContain("button--primary");
    expect(button.getAttribute("type")).toBe("button");
  });
});

describe("Avatar", () => {
  it("読み上げない。装備を重ねる", () => {
    const { container } = render(<Avatar gear={["hat", "cape"]} size="drawer" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("avatar--drawer");
    expect(container.querySelectorAll("g")).toHaveLength(2);
  });

  it("顔だけの絵は装備を描かず、読み上げない", () => {
    const { container } = render(<AvatarFace />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("g")).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });
});

describe("Toast", () => {
  it("role=status を最初から置き、文を出す", () => {
    const { rerender } = render(<Toast toast={null} />);
    expect(screen.getByRole("status").className).not.toContain("is-shown");
    rerender(<Toast toast={{ id: 1, text: "+20" }} />);
    expect(screen.getByRole("status").textContent).toBe("+20");
    expect(screen.getByRole("status").className).toContain("is-shown");
  });
});

describe("Panel", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>開く</button>
        <Panel open={open} onClose={() => setOpen(false)} labelledBy="t">
          <h2 id="t">見出し</h2>
        </Panel>
      </>
    );
  }

  it("開くと中身が出て、閉じると押した物へフォーカスが戻る", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "開く" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    expect(document.querySelector("h2")?.textContent).toBe("見出し");
    act(() => { (document.querySelector("dialog") as HTMLDialogElement).close(); });
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector("h2")).toBeNull();
  });
});

describe("Panel（引き出し）", () => {
  function Drawer() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>顔</button>
        <Panel open={open} onClose={() => setOpen(false)} labelledBy="d" variant="drawer">
          <h2 id="d">記録</h2>
          <button type="button">中のボタン</button>
        </Panel>
      </>
    );
  }

  it("drawer の種類を持ち、覆いを押すと閉じて、顔のボタンへフォーカスが戻る", () => {
    render(<Drawer />);
    const trigger = screen.getByRole("button", { name: "顔" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.className).toContain("panel--drawer");
    expect(dialog.hasAttribute("open")).toBe(true);
    // 中の操作要素のクリックでは閉じない
    fireEvent.click(screen.getByRole("button", { name: "中のボタン" }));
    expect(dialog.hasAttribute("open")).toBe(true);
    // dialog 自身の外（覆い）のクリックで閉じる
    fireEvent.click(dialog, { clientX: -5, clientY: -5 });
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
