import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeBackButton } from "./HomeBackButton";

const played = vi.hoisted(() => [] as string[]);
vi.mock("../audio/use-bgm", () => ({ playSe: (kind: string) => played.push(kind) }));

beforeEach(() => {
  played.length = 0;
});

describe("「← ホーム」（CP-784）", () => {
  it("押した時に選ぶ音を鳴らさない。戻る音は playBackWave が鳴らす（D-104、D-154）", () => {
    const onClick = vi.fn();
    render(<HomeBackButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(played).toEqual([]);
  });
});
