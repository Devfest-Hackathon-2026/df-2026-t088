import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../audio/use-bgm", () => ({ playSe: (kind: string) => played.push(kind) }));

beforeEach(() => {
  played.length = 0;
});

describe("CMP-001 ボタンの効果音（D-104）", () => {
  it("押すと選ぶ音を鳴らしてから、渡した処理を呼ぶ", () => {
    const onClick = vi.fn(() => expect(played).toEqual(["select"]));
    render(<Button onClick={onClick}>えらぶ</Button>);
    fireEvent.click(screen.getByRole("button", { name: "えらぶ" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("決定のボタンは決定の音にできる", () => {
    render(<Button se="enter">つぎへ</Button>);
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(played).toEqual(["enter"]);
  });

  it("結果の音や戻る音が別に鳴るボタンは、押した音を鳴らさない", () => {
    const onClick = vi.fn();
    render(<Button se={null} onClick={onClick}>もどる</Button>);
    fireEvent.click(screen.getByRole("button", { name: "もどる" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(played).toEqual([]);
  });
});
