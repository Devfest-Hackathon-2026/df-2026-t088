// 子どもの番号の口（仮）。今は、ビルドの設定 VITE_STUDENT_NUMBER（形に合わなければ A-01）。
// 公開用は、子どものログインの session から番号を取る形に、この関数の中身だけを差し替える（契約の「番号は session から」）。
// 家庭学習の提出（pages/home/api.ts）と、進みの送信（game/progress-sync.ts）は、どちらもこの口を使う。
const NUMBER_PATTERN = /^[A-Z]-\d{2}$/;

export function currentStudentNumber(): string {
  const value = import.meta.env.VITE_STUDENT_NUMBER as string | undefined;
  return value && NUMBER_PATTERN.test(value) ? value : "A-01";
}
