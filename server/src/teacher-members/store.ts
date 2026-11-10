// 先生の名簿（メール → 役割）。決まりの正本は docs/product/education-api-contract.md「先生の役割の管理の API」。
// 今回はメモリのストアだけ（再起動で環境変数の初めの値に戻る）。Firestore への保存は、プリントの保存（#333）が入った後に別で足す。
// 読む側（list・get）は同期にしてある。ログインの判定が同期で動く経路（loop など）で使うため。
// 保存先を替えるときも、起動時に読み込んだ写しを持てば、この形のまま使える。

export type MemberRole = "admin" | "teacher";
export type Member = { email: string; role: MemberRole };
export type SetResult = "added" | "changed" | "last-admin";
export type RemoveResult = "removed" | "not-found" | "last-admin";

export interface TeacherMemberStore {
  /** メールの昇順 */
  list(): Member[];
  get(email: string): Member | undefined;
  /** 足す・役割を変える。最後の管理者を先生に変えることはしない（名簿の決まりをここで守り、呼ぶ側の確認と競らないようにする） */
  set(email: string, role: MemberRole): Promise<SetResult>;
  /** 外す。最後の管理者は外さない */
  remove(email: string): Promise<RemoveResult>;
}

/** メールは前後の空白を除き、小文字にそろえて比べる */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class MemoryTeacherMemberStore implements TeacherMemberStore {
  private readonly roles = new Map<string, MemberRole>();

  constructor(initial: Member[] = []) {
    for (const member of initial) {
      const email = normalizeEmail(member.email);
      if (email === "") continue;
      // 同じメールが重なれば、管理者を優先する
      if (this.roles.get(email) !== "admin") this.roles.set(email, member.role);
    }
  }

  list(): Member[] {
    return [...this.roles].map(([email, role]) => ({ email, role })).sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0));
  }

  get(email: string): Member | undefined {
    const key = normalizeEmail(email);
    const role = this.roles.get(key);
    return role ? { email: key, role } : undefined;
  }

  async set(email: string, role: MemberRole): Promise<SetResult> {
    const key = normalizeEmail(email);
    const current = this.roles.get(key);
    if (current === "admin" && role !== "admin" && this.adminCount() <= 1) return "last-admin";
    this.roles.set(key, role);
    return current === undefined ? "added" : "changed";
  }

  async remove(email: string): Promise<RemoveResult> {
    const key = normalizeEmail(email);
    const current = this.roles.get(key);
    if (current === undefined) return "not-found";
    if (current === "admin" && this.adminCount() <= 1) return "last-admin";
    this.roles.delete(key);
    return "removed";
  }

  private adminCount(): number {
    let count = 0;
    for (const role of this.roles.values()) if (role === "admin") count += 1;
    return count;
  }
}
