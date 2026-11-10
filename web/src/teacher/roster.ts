// 先生の端末の名簿（TBL-005。docs/design/home/08_database.md）。サーバーには送らない（D-T01、D-T06）
import { ROSTER_SAMPLE_NAMES } from "./copy";

export const ROSTER_KEY = "teacher-roster-v1";
const NUMBER_PATTERN = /^[A-Z]-\d{2}$/;
const NAME_MAX = 20;

export type Roster = Record<string, string>;

/** 「番号 名前」の行を読む。区切りは半角・全角の空白かタブ。同じ番号は後の行。読めない行は数える */
export function parseRoster(text: string): { roster: Roster; failed: number } {
  const roster: Roster = {};
  let failed = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^(\S+)[\s　]+(.+)$/u.exec(line);
    const number = match?.[1] ?? "";
    const name = (match?.[2] ?? "").trim();
    if (!NUMBER_PATTERN.test(number) || name.length < 1 || [...name].length > NAME_MAX) {
      failed += 1;
      continue;
    }
    roster[number] = name;
  }
  return { roster, failed };
}

export const sampleRoster = (): Roster =>
  Object.fromEntries(ROSTER_SAMPLE_NAMES.map((name, index) => [`A-${String(index + 1).padStart(2, "0")}`, name]));

export function loadRoster(): Roster {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ROSTER_KEY) ?? "null");
    if (typeof value !== "object" || value === null || (value as { version?: unknown }).version !== 1) return {};
    const entries = (value as { entries?: unknown }).entries;
    if (!Array.isArray(entries)) return {};
    const roster: Roster = {};
    for (const entry of entries) {
      if (entry && typeof entry.number === "string" && typeof entry.name === "string" && NUMBER_PATTERN.test(entry.number)) roster[entry.number] = entry.name;
    }
    return roster;
  } catch {
    return {};
  }
}

export function saveRoster(roster: Roster): void {
  try {
    const entries = Object.entries(roster).sort(([a], [b]) => a.localeCompare(b)).map(([number, name]) => ({ number, name }));
    localStorage.setItem(ROSTER_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // 保存できない端末（プライベートの窓など）では、この画面を開いている間だけ使う
  }
}

export function clearRoster(): void {
  try {
    localStorage.removeItem(ROSTER_KEY);
  } catch {
    // 消せない時も画面の名簿は消す
  }
}
