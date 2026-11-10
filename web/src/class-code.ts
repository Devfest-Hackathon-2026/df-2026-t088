// 子どもの端末に残す学級コード。localStorage が使えなくても画面は出す（読めなければ無し、書けなければ黙って残さない）
export const CLASS_CODE_KEY = "sugoroku:class-code";

export function readClassCode(): string | null {
  try {
    const value = window.localStorage.getItem(CLASS_CODE_KEY);
    return value && /^[A-Za-z0-9]{1,32}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveClassCode(code: string): void {
  try {
    window.localStorage.setItem(CLASS_CODE_KEY, code);
  } catch {
    // 残せなくても、今の画面はそのまま使える
  }
}
