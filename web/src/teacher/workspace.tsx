// 先生の学級（ワークスペース）。形は docs/product/education-api-contract.md「学級（ワークスペース）の API」
import { createContext, useContext } from "react";

/** childCapture：子どもが学級コードで自分のプリントを撮ってよいか（先生が学級ごとに選ぶ。既定は切） */
export type Workspace = { id: string; name: string; joinCode: string; childCapture?: boolean };

/** TeacherGate が /api/v1/teacher/me から読んだもの。学級があるのは、ログインが on で入っているときだけ */
// guest は、ログインなしで作ったお試しの学級（上の並びが「学級をとじる」を出す）
export type TeacherSession = { workspace?: Workspace; guest?: boolean };

type TeacherSessionValue = { session: TeacherSession; setWorkspace: (workspace: Workspace) => void };

export const TeacherSessionContext = createContext<TeacherSessionValue>({ session: {}, setWorkspace: () => {} });

export const useTeacherSession = () => useContext(TeacherSessionContext);

/** me の workspace が契約の形のときだけ返す */
export function parseWorkspace(raw: unknown): Workspace | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const { id, name, joinCode, childCapture } = raw as Record<string, unknown>;
  return typeof id === "string" && typeof name === "string" && typeof joinCode === "string" && joinCode !== "" ? { id, name, joinCode, childCapture: childCapture === true } : undefined;
}

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";

/** 学級の名前を直す。直せなければ投げる */
export async function renameWorkspace(name: string): Promise<Workspace> {
  const response = await fetch(`${apiBase}/api/v1/workspace`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  if (!response.ok) throw new Error(String(response.status));
  const workspace = parseWorkspace(await response.json());
  if (!workspace) throw new Error("shape");
  return workspace;
}

/** 子どもの撮影を入れる・切る。変えられなければ投げる */
export async function setChildCapture(on: boolean): Promise<Workspace> {
  const response = await fetch(`${apiBase}/api/v1/workspace`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ childCapture: on }) });
  if (!response.ok) throw new Error(String(response.status));
  const workspace = parseWorkspace(await response.json());
  if (!workspace) throw new Error("shape");
  return workspace;
}

/** お試しの学級をつくる（サーバーが Cookie を付ける）。作れなければ、サーバーの文（あれば）つきで投げる */
export class GuestWorkspaceError extends Error {}
export async function createGuestWorkspace(): Promise<void> {
  const response = await fetch(`${apiBase}/api/v1/teacher/guest`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (response.ok) return;
  let message = "";
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") message = body.error.message;
  } catch {
    // 本文が読めないときは、画面の既定の文を出す
  }
  throw new GuestWorkspaceError(message);
}

export async function logoutTeacher(): Promise<void> {
  // 本文の無い POST は、サーバが 415 で断る（JSON だけ受ける。guard.ts）。空の JSON を送る
  const response = await fetch(`${apiBase}/api/v1/teacher/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("logout failed");
}

/** 子ども用のリンク */
export const joinUrl = (code: string) => `${window.location.origin}/join/${code}`;
