import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ACCOUNT_KEY } from "./account";
import { DEFAULT_LOOK, loadPhoto, savePhoto, usePhoto } from "./photo";
import type { PhotoLook } from "./photo";

const LOOK: PhotoLook = { pose: "peace", face: "wink", bg: "sansu", frame: "tape", stamp: "subject", gear: ["hat", "pencil"] };

beforeEach(() => localStorage.clear());

const put = (photo: unknown) => localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 4, photo }));

describe("写真の読み込み", () => {
  it("保存が無ければ null", () => {
    expect(loadPhoto()).toBeNull();
    expect(loadPhoto({ getItem: () => null })).toBeNull();
  });

  it("保存した形を読める", () => {
    put(LOOK);
    expect(loadPhoto()).toEqual(LOOK);
  });

  it("壊れた値は null（JSON・オブジェクトでない photo）", () => {
    localStorage.setItem(ACCOUNT_KEY, "{");
    expect(loadPhoto()).toBeNull();
    for (const photo of [null, [], "x", 1]) {
      put(photo);
      expect(loadPhoto()).toBeNull();
    }
  });

  it("知らない id は null", () => {
    for (const key of ["pose", "face", "bg", "frame", "stamp"] as const) {
      put({ ...LOOK, [key]: "nothing" });
      expect(loadPhoto()).toBeNull();
    }
    put({ ...LOOK, pose: undefined });
    expect(loadPhoto()).toBeNull();
  });

  it("gear は装備の id で、重ならず、5つまで", () => {
    put({ ...LOOK, gear: [] });
    expect(loadPhoto()?.gear).toEqual([]);
    put({ ...LOOK, gear: ["hat", "hat"] });
    expect(loadPhoto()).toBeNull();
    put({ ...LOOK, gear: ["sword"] });
    expect(loadPhoto()).toBeNull();
    put({ ...LOOK, gear: "hat" });
    expect(loadPhoto()).toBeNull();
    put({ ...LOOK, gear: ["pencil", "hat", "cape", "wings", "crown", "hat"] });
    expect(loadPhoto()).toBeNull();
    put({ ...LOOK, gear: ["pencil", "hat", "cape", "wings", "crown"] });
    expect(loadPhoto()?.gear).toHaveLength(5);
  });
});

describe("写真の保存", () => {
  it("avatarId と grade を残して photo を書く", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 3 }));
    expect(savePhoto(LOOK)).toBe(true);
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "")).toEqual({ avatarId: "default", grade: 3, photo: LOOK });
  });

  it("保存できなければ false。投げない", () => {
    expect(savePhoto(LOOK, null)).toBe(false);
    expect(savePhoto(LOOK, { getItem: () => null, setItem: () => { throw new Error("full"); } })).toBe(false);
  });

  it("usePhoto は保存の前は null、保存の後に描き直る", () => {
    const { result } = renderHook(() => usePhoto());
    expect(result.current).toBeNull();
    act(() => { savePhoto(LOOK); });
    expect(result.current).toEqual(LOOK);
    act(() => { savePhoto({ ...DEFAULT_LOOK, gear: [] }); });
    expect(result.current).toEqual({ ...DEFAULT_LOOK, gear: [] });
  });
});
