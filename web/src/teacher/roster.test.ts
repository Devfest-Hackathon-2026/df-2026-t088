import { beforeEach, describe, expect, it } from "vitest";
import { ROSTER_KEY, clearRoster, loadRoster, parseRoster, sampleRoster, saveRoster } from "./roster";

beforeEach(() => { localStorage.clear(); });

describe("名簿（先生の端末だけ）", () => {
  it("「番号 名前」を半角・全角の空白とタブで読み、読めない行を数える。同じ番号は後の行", () => {
    const { roster, failed } = parseRoster("A-01 青木 ひなた\nA-02　石川 そうた\nA-03\t上田 みお\n\nB-1 だめ\nA-04\nA-01 青木 ひなた2\nA-05 " + "あ".repeat(21));
    expect(roster).toEqual({ "A-01": "青木 ひなた2", "A-02": "石川 そうた", "A-03": "上田 みお" });
    expect(failed).toBe(3);
  });

  it("見本は架空の30人で A-01 から順", () => {
    const sample = sampleRoster();
    expect(Object.keys(sample)).toHaveLength(30);
    expect(sample["A-01"]).toBe("青木 ひなた");
    expect(sample["A-30"]).toBe("渡辺 けんた");
  });

  it("端末に保存して読み直せ、消せる。形の違う値は読まない", () => {
    saveRoster({ "A-02": "石川 そうた" });
    expect(JSON.parse(localStorage.getItem(ROSTER_KEY) ?? "{}")).toEqual({ version: 1, entries: [{ number: "A-02", name: "石川 そうた" }] });
    expect(loadRoster()).toEqual({ "A-02": "石川 そうた" });
    clearRoster();
    expect(loadRoster()).toEqual({});
    localStorage.setItem(ROSTER_KEY, "{broken");
    expect(loadRoster()).toEqual({});
  });
});
