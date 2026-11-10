// 学級（ワークスペース）の保存。決まりの正本は docs/product/education-api-contract.md「学級（ワークスペース）の API」。
// 持ち主はメールから作った印（sub）で持ち、メールは保存しない。保存はメモリ。Firestore の設定があるときは firestore-store.ts が写しを保存する
import { randomInt, randomUUID } from "node:crypto";

/** 承認キーで配ったもの・ログインしていない子どもの一覧は、この見本の学級 */
export const DEMO_WORKSPACE_ID = "demo";

/** childCapture：先生が入れた学級だけ、子どもが学級コードで自分のプリントを撮れる（既定は切） */
export type Workspace = { id: string; name: string; joinCode: string; createdAt: string; childCapture: boolean };

export interface WorkspaceStore {
  byOwner(ownerSub: string): Workspace | undefined;
  /** 大文字小文字を区別しない */
  byJoinCode(code: string): Workspace | undefined;
  /** 無ければ作る。あればそれを返す。数の上限を超えたら "full" */
  ensureFor(ownerSub: string, now: Date): Workspace | "full";
  rename(ownerSub: string, name: string): Workspace | undefined;
  /** 子どもの撮影を入れる・切る。学級が無ければ undefined */
  setChildCapture(ownerSub: string, on: boolean): Workspace | undefined;
  /** 今日の読み取りを 1 回数える。上限を超えていたら false（数えない）。日付は日本時間 */
  countRead(workspaceId: string, now: Date): boolean;
}

export const MAX_WORKSPACES = 2000;
export const DEFAULT_READS_PER_DAY = 30;
export const DEFAULT_WORKSPACE_NAME = "わたしの学級";
const NAME_MAX = 30;
const JOIN_CODE_LENGTH = 6;
// 0・O・1・I を使わない（読み間違えを防ぐ）
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;

/** 学級の名前を整える。前後の空白を除き、1〜30 文字で、制御文字が無ければその文字列。違えば undefined */
export function normalizeWorkspaceName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  const length = Array.from(name).length;
  if (length < 1 || length > NAME_MAX || CONTROL_CHARACTER.test(name)) return undefined;
  return name;
}

/** WORKSPACE_READS_PER_DAY を読む。正の整数でなければ既定（30） */
export function readReadsPerDay(environment: NodeJS.ProcessEnv): number {
  const text = environment.WORKSPACE_READS_PER_DAY?.trim() ?? "";
  if (!/^\d+$/.test(text)) return DEFAULT_READS_PER_DAY;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= 1 ? value : DEFAULT_READS_PER_DAY;
}

export const jstDay = (now: Date): string => new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

function newJoinCode(): string {
  let code = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}

/** 保存先（Firestore）へ写すための通知。メモリの変更のあとに同期で呼ばれる */
export type WorkspaceChangeHooks = {
  created(ownerSub: string, workspace: Workspace): void;
  renamed(ownerSub: string, workspace: Workspace): void;
  childCaptureSet(ownerSub: string, workspace: Workspace): void;
  read(workspaceId: string, day: string, count: number): void;
};
/** 起動時に保存先から読んだもの */
export type WorkspaceSeed = { workspaces: { ownerSub: string; workspace: Workspace }[]; reads: { workspaceId: string; day: string; count: number }[] };

export type MemoryWorkspaceOptions = { maxWorkspaces?: number; readsPerDay?: number; seed?: WorkspaceSeed; hooks?: WorkspaceChangeHooks };

export function createMemoryWorkspaceStore(options: MemoryWorkspaceOptions = {}): WorkspaceStore {
  const maxWorkspaces = options.maxWorkspaces ?? MAX_WORKSPACES;
  const readsPerDay = options.readsPerDay ?? DEFAULT_READS_PER_DAY;
  const owners = new Map<string, Workspace>();
  const codes = new Map<string, Workspace>();
  const reads = new Map<string, { day: string; count: number }>();
  const copy = (workspace: Workspace): Workspace => ({ ...workspace });
  const hooks = options.hooks;
  for (const { ownerSub, workspace } of options.seed?.workspaces ?? []) {
    owners.set(ownerSub, { ...workspace, childCapture: workspace.childCapture === true });
    codes.set(workspace.joinCode.toUpperCase(), owners.get(ownerSub)!);
  }
  for (const { workspaceId, day, count } of options.seed?.reads ?? []) reads.set(workspaceId, { day, count });

  return {
    byOwner(ownerSub) {
      const found = owners.get(ownerSub);
      return found ? copy(found) : undefined;
    },
    byJoinCode(code) {
      const found = codes.get(code.toUpperCase());
      return found ? copy(found) : undefined;
    },
    ensureFor(ownerSub, now) {
      const existing = owners.get(ownerSub);
      if (existing) return copy(existing);
      if (owners.size >= maxWorkspaces) return "full";
      // 重なったら作り直す。学級の数の上限が小さいので、作り直しはほぼ起きない
      let joinCode = newJoinCode();
      while (codes.has(joinCode)) joinCode = newJoinCode();
      const workspace: Workspace = { id: randomUUID(), name: DEFAULT_WORKSPACE_NAME, joinCode, createdAt: now.toISOString(), childCapture: false };
      owners.set(ownerSub, workspace);
      codes.set(joinCode, workspace);
      hooks?.created(ownerSub, copy(workspace));
      return copy(workspace);
    },
    rename(ownerSub, name) {
      const found = owners.get(ownerSub);
      const next = normalizeWorkspaceName(name);
      if (!found || next === undefined) return undefined;
      found.name = next;
      hooks?.renamed(ownerSub, copy(found));
      return copy(found);
    },
    setChildCapture(ownerSub, on) {
      const found = owners.get(ownerSub);
      if (!found) return undefined;
      found.childCapture = on;
      hooks?.childCaptureSet(ownerSub, copy(found));
      return copy(found);
    },
    countRead(workspaceId, now) {
      const day = jstDay(now);
      const current = reads.get(workspaceId);
      if (!current || current.day !== day) {
        reads.set(workspaceId, { day, count: 1 });
        hooks?.read(workspaceId, day, 1);
        return readsPerDay >= 1;
      }
      if (current.count >= readsPerDay) return false;
      current.count += 1;
      hooks?.read(workspaceId, day, current.count);
      return true;
    },
  };
}
