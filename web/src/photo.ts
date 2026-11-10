import { useSyncExternalStore } from "react";
import { ACCOUNT_KEY } from "./account";
import { EQUIPMENT } from "./data";
import type { GearId } from "./data";

// アバターの写真（CMP-040、D-199）。画像は作らず、選び方の id だけを sugoroku:account の photo に置く
export const POSE_IDS = ["stand", "wave", "banzai", "run", "peace", "think", "jump"] as const;
export const FACE_IDS = ["smile", "wink", "surprise", "proud"] as const;
export const BG_IDS = ["grid", "kokugo", "sansu", "rika", "shakai", "eigo"] as const;
export const FRAME_IDS = ["none", "cheki", "tape", "star", "cell"] as const;
export const STAMP_IDS = ["none", "hanamaru", "star", "heart", "subject"] as const;

export type PoseId = (typeof POSE_IDS)[number];
export type FaceId = (typeof FACE_IDS)[number];
export type BgId = (typeof BG_IDS)[number];
export type FrameId = (typeof FRAME_IDS)[number];
export type StampId = (typeof STAMP_IDS)[number];

export interface PhotoLook {
  pose: PoseId;
  face: FaceId;
  bg: BgId;
  frame: FrameId;
  stamp: StampId;
  gear: GearId[];
}

export const DEFAULT_LOOK: Omit<PhotoLook, "gear"> = { pose: "stand", face: "smile", bg: "grid", frame: "none", stamp: "none" };

const MAX_GEAR = 5;
const GEAR_IDS: readonly string[] = EQUIPMENT.map((item) => item.id);

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function pick<T extends string>(ids: readonly T[], value: unknown): T | null {
  return ids.find((id) => id === value) ?? null;
}

/** 5つまでで、装備の id だけ、重なりなし */
function asGear(value: unknown): GearId[] | null {
  if (!Array.isArray(value) || value.length > MAX_GEAR) return null;
  const seen = new Set<unknown>();
  for (const item of value) {
    if (typeof item !== "string" || !GEAR_IDS.includes(item) || seen.has(item)) return null;
    seen.add(item);
  }
  return value as GearId[];
}

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

/** 写真が無い・壊れた・知らない値は null。投げない */
export function loadPhoto(storage: ReadStorage | null = safeStorage()): PhotoLook | null {
  const raw = readStoredObject(storage)?.photo;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const pose = pick(POSE_IDS, p.pose);
  const face = pick(FACE_IDS, p.face);
  const bg = pick(BG_IDS, p.bg);
  const frame = pick(FRAME_IDS, p.frame);
  const stamp = pick(STAMP_IDS, p.stamp);
  const gear = asGear(p.gear);
  if (!pose || !face || !bg || !frame || !stamp || !gear) return null;
  return { pose, face, bg, frame, stamp, gear };
}

// useSyncExternalStore 用。getSnapshot は同じ中身なら同じ物を返す（無限に描き直さない）
const listeners = new Set<() => void>();
let snapshot: PhotoLook | null = null;
let snapshotKey: string | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PhotoLook | null {
  const look = loadPhoto();
  const key = JSON.stringify(look);
  if (key !== snapshotKey) {
    snapshotKey = key;
    snapshot = look;
  }
  return snapshot;
}

/** avatarId・grade など photo 以外の項目は残して photo を書く。保存後に購読者へ知らせる。投げない */
export function savePhoto(look: PhotoLook, storage: WriteStorage | null = safeStorage()): boolean {
  try {
    if (!storage) return false;
    const stored = readStoredObject(storage) ?? {};
    storage.setItem(ACCOUNT_KEY, JSON.stringify({ ...stored, photo: look }));
  } catch {
    return false;
  }
  listeners.forEach((listener) => listener());
  return true;
}

/** 保存された写真。savePhoto の後に描き直る */
export function usePhoto(): PhotoLook | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
