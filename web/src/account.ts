import { GRADES } from "./data/kanji-grades";
import type { Grade } from "./data/kanji-grades";

// 端末の仮アカウント（TBL-001・API-001）。名前は保存せず、見本の名前を出す
export const ACCOUNT_KEY = "sugoroku:account";
// 学年を別のキーに置いていた頃の名残（#188）。取り込んだら消す
export const LEGACY_GRADE_KEY = "sugoroku:grade";
const LEARNING_GRADE_KEY = "sugoroku:learning-grade";
export const SAMPLE_ACCOUNT_NAME = "さとう ひなた";
export const DEFAULT_AVATAR_ID = "default";
// #190 で8種類の id が決まったら Avatar.tsx の側へ移す
export const AVATAR_IDS = ["default"] as const;

export interface Account {
  name: string;
  avatarId: string;
  grade: Grade;
}

type ReadStorage = Pick<Storage, "getItem">;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isKnownAvatarId(value: unknown): value is (typeof AVATAR_IDS)[number] {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

/** 1〜6 の整数だけを学年にする。"3" や 2.5 は認めない */
function asGrade(value: unknown): Grade | null {
  return GRADES.find((grade) => grade === value) ?? null;
}

// 公開ビルドの既定学年。未設定・不正な値は、チームで決めた6年にする
const configuredDefaultGrade = import.meta.env.VITE_DEFAULT_GRADE;
export const DEFAULT_GRADE: Grade =
  typeof configuredDefaultGrade === "string" && /^[1-6]$/.test(configuredDefaultGrade)
    ? (Number(configuredDefaultGrade) as Grade)
    : 6;

/** 古い `sugoroku:grade` は文字列で保存していた。1〜6 の整数の文字列だけ読む */
function readLegacyGrade(storage: ReadStorage | null): Grade | null {
  try {
    const raw = storage?.getItem(LEGACY_GRADE_KEY);
    if (raw == null || !/^\d$/.test(raw)) return null;
    return asGrade(Number(raw));
  } catch {
    return null;
  }
}

/** 保存された JSON をオブジェクトとして読む。読めなければ null。投げない */
function readStoredObject(storage: ReadStorage | null): Record<string, unknown> | null {
  try {
    const raw = storage?.getItem(ACCOUNT_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 読めない・壊れた・知らない値は見本の名前・既定のアバター・古いキーの学年（無ければ既定の学年）にする。投げない */
export function loadAccount(storage: ReadStorage | null = safeStorage()): Account {
  const stored = readStoredObject(storage);
  return {
    name: SAMPLE_ACCOUNT_NAME,
    avatarId: isKnownAvatarId(stored?.avatarId) ? stored.avatarId : DEFAULT_AVATAR_ID,
    grade: asGrade(stored?.grade) ?? readLegacyGrade(storage) ?? DEFAULT_GRADE,
  };
}

/**
 * 起動時は明示的に選んだ教材の学年を使う。未選択の本番は仮アカウントの値を使わず、既定の学年にする。
 * 開発中（テストも）は保存の学年（古いキーの取り込みを含む）、無ければ既定の学年。判定は引数で差し替えられる。
 * e2e のビルド（VITE_E2E_SAVED_GRADE=on）だけは、本番でも保存の学年を読む。5年の教材の e2e のため。公開ビルドには設定しない
 */
export function initialGrade(
  isProduction: boolean = import.meta.env.PROD && import.meta.env.VITE_E2E_SAVED_GRADE !== "on",
  storage: Storage | null = safeStorage(),
): Grade {
  try {
    const selection = storage?.getItem(LEARNING_GRADE_KEY);
    const grade = GRADES.find((candidate) => String(candidate) === selection);
    if (grade !== undefined) return grade;
  } catch {
    // 保存を読めない場合も既定の学年で開く。
  }
  if (isProduction) return DEFAULT_GRADE;
  migrateLegacyGrade(storage);
  return loadAccount(storage).grade;
}

/** 生徒が選んだ教材の学年。仮アカウントの学年とは別に保持する。 */
export function saveLearningGrade(grade: Grade): void {
  try {
    safeStorage()?.setItem(LEARNING_GRADE_KEY, String(grade));
  } catch {
    // 保存できない場合も、この画面では切り替えられる。
  }
}

/** アカウントの学年を書く。avatarId と photo は今の値を残す（avatarId が壊れていれば default）。投げない */
export function saveAccountGrade(
  grade: Grade,
  storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage(),
): void {
  try {
    const { avatarId } = loadAccount(storage);
    // 写真（photo）など、ほかの項目は残す
    const { photo } = readStoredObject(storage) ?? {};
    storage?.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId, grade, ...(photo === undefined ? {} : { photo }) }));
  } catch {
    // 残せなくても、この画面の間は切り替わる
  }
}

/**
 * 古い `sugoroku:grade` の取り込み（TBL-001）。アカウントに有効な学年が無く、
 * 古いキーに 1〜6 がある時だけ、アカウントへ書いて古いキーを消す。投げない
 */
export function migrateLegacyGrade(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeStorage(),
): void {
  try {
    if (asGrade(readStoredObject(storage)?.grade) !== null) return;
    const legacy = readLegacyGrade(storage);
    if (legacy === null) return;
    saveAccountGrade(legacy, storage);
    storage?.removeItem(LEGACY_GRADE_KEY);
  } catch {
    // 取り込めなくても、次に開いた時にもう一度試す
  }
}
