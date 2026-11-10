import { ACCOUNT_KEY } from "./account";

// 5年の分数の教材を確かめるテスト用。保存に grade:5 を置く（開発中に5年を選んだ時。FR-012）。
// localStorage.clear() のあとに呼ぶ。GradeProvider は描く時にこの保存を読む
export function saveGrade5ForTest(): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 5 }));
}
