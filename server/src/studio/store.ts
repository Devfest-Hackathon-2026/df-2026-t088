import type { StudioLesson } from "./lesson-ir.ts";
import { applyStudioPatch, type StudioPatch } from "./patch.ts";
import { validateLessonIr } from "./validate-ir.ts";

export type StudioVersionStatus = "draft" | "validating" | "review_required" | "approved" | "published" | "rejected" | "revoked";
export type StudioAuditAction = "decide" | "revoke";
export type StudioGeneration = { source: "gemini" | "mock"; model: string; elapsedMs: number };
export type StudioAuditEntry = {
  id: number; at: string; role: "teacher"; action: StudioAuditAction; targetId: string; detail: string; reason: string; result: "allowed" | "denied";
};
export type StudioVersion = {
  id: string; lessonId: string; number: number; baseVersion: number | null; status: StudioVersionStatus;
  transitions: StudioVersionStatus[]; lesson: StudioLesson; validation: { ok: true } | { ok: false; issues: string[] };
  createdAt: string; isFixture: boolean; generation?: StudioGeneration;
};
export type StudioStoreOptions = { now?: () => Date; writeAudit?: (entry: Omit<StudioAuditEntry, "id" | "at">) => void };
export type StoreResult<T> = { ok: true; value: T } | { ok: false; code: "NOT_FOUND" | "ALREADY_DECIDED" | "STALE_BASE_VERSION" | "INVALID_PATCH"; issues?: string[]; currentVersion?: number };

export type StudioStore = {
  createLesson(id: string, lesson: StudioLesson, options?: { isFixture?: boolean; awaitApproval?: boolean; generation?: StudioGeneration }): StudioVersion | undefined;
  getVersions(lessonId: string): StudioVersion[];
  getVersion(lessonId: string, versionNumber: number): StudioVersion | undefined;
  getCurrentVersion(lessonId: string): StudioVersion | undefined;
  applyPatch(lessonId: string, patch: StudioPatch, options?: { generation?: StudioGeneration }): StoreResult<{ version: StudioVersion }>;
  decide(lessonId: string, versionNumber: number, decision: "approved" | "rejected"): StoreResult<{ version: StudioVersion }>;
  revoke(lessonId: string, versionNumber: number): StoreResult<{ revoked: StudioVersion; restored: StudioVersion }>;
  addAudit(entry: Omit<StudioAuditEntry, "id" | "at">): void;
  auditLog(): StudioAuditEntry[];
};

export function createStudioStore(options: StudioStoreOptions = {}): StudioStore {
  const now = options.now ?? (() => new Date());
  const lessons = new Map<string, StudioVersion[]>();
  const audit: StudioAuditEntry[] = [];
  let nextAuditId = 1;

  const cloneVersion = (version: StudioVersion): StudioVersion => ({
    ...version,
    transitions: [...version.transitions],
    lesson: structuredClone(version.lesson),
    validation: version.validation.ok ? { ok: true } : { ok: false, issues: [...version.validation.issues] },
    ...(version.generation ? { generation: { ...version.generation } } : {}),
  });
  const versionsFor = (lessonId: string) => lessons.get(lessonId) ?? [];
  const current = (lessonId: string) => [...versionsFor(lessonId)].reverse().find((version) => version.status !== "revoked" && version.status !== "rejected");
  const transition = (version: StudioVersion, status: StudioVersionStatus) => {
    version.status = status;
    version.transitions.push(status);
  };

  return {
    createLesson(id, lesson, createOptions = {}) {
      if (!id.trim() || lessons.has(id)) return undefined;
      const validation = validateLessonIr(lesson);
      if (!validation.ok) return undefined;
      const version: StudioVersion = {
        // 生成した教材（awaitApproval）は、先生の承認を待つ版 1 にする
        id: `${id}@v1`, lessonId: id, number: 1, baseVersion: null, status: createOptions.awaitApproval ? "review_required" : "published",
        transitions: createOptions.awaitApproval ? ["draft", "validating", "review_required"] : ["draft", "validating", "review_required", "approved", "published"],
        lesson: structuredClone(lesson), validation, createdAt: now().toISOString(), isFixture: createOptions.isFixture ?? false,
        ...(createOptions.generation ? { generation: { ...createOptions.generation } } : {}),
      };
      lessons.set(id, [version]);
      return cloneVersion(version);
    },
    getVersions(lessonId) {
      return [...versionsFor(lessonId)].reverse().map(cloneVersion);
    },
    getVersion(lessonId, versionNumber) {
      const version = versionsFor(lessonId).find((item) => item.number === versionNumber);
      return version && cloneVersion(version);
    },
    getCurrentVersion(lessonId) {
      const version = current(lessonId);
      return version && cloneVersion(version);
    },
    applyPatch(lessonId, patch, patchOptions = {}) {
      const versions = versionsFor(lessonId);
      const base = current(lessonId);
      if (!base) return { ok: false, code: "NOT_FOUND" };
      if (patch.baseVersion !== base.number) return { ok: false, code: "STALE_BASE_VERSION", currentVersion: base.number };
      if (base.status === "review_required" || base.status === "draft" || base.status === "validating") return { ok: false, code: "ALREADY_DECIDED" };
      const applied = applyStudioPatch(base.lesson, patch);
      if (!applied.ok) return { ok: false, code: "INVALID_PATCH", issues: applied.issues };
      const number = Math.max(...versions.map((version) => version.number)) + 1;
      const validation = validateLessonIr(applied.lesson);
      const version: StudioVersion = {
        id: `${lessonId}@v${number}`, lessonId, number, baseVersion: base.number,
        status: "draft", transitions: ["draft"], lesson: applied.lesson, validation,
        createdAt: now().toISOString(), isFixture: base.isFixture,
        ...(patchOptions.generation ? { generation: { ...patchOptions.generation } } : {}),
      };
      versions.push(version);
      transition(version, "validating");
      transition(version, validation.ok ? "review_required" : "rejected");
      return validation.ok
        ? { ok: true, value: { version: cloneVersion(version) } }
        : { ok: false, code: "INVALID_PATCH", issues: [...validation.issues] };
    },
    decide(lessonId, versionNumber, decision) {
      const version = versionsFor(lessonId).find((item) => item.number === versionNumber);
      if (!version) return { ok: false, code: "NOT_FOUND" };
      if (version.status !== "review_required") return { ok: false, code: "ALREADY_DECIDED" };
      if (decision === "approved") {
        transition(version, "approved");
        transition(version, "published");
      } else {
        transition(version, "rejected");
      }
      return { ok: true, value: { version: cloneVersion(version) } };
    },
    revoke(lessonId, versionNumber) {
      const versions = versionsFor(lessonId);
      const target = versions.find((item) => item.number === versionNumber);
      const currentVersion = current(lessonId);
      const restored = versions.slice(0, -1).reverse().find((item) => item.status === "published");
      if (!target || !restored) return { ok: false, code: "NOT_FOUND" };
      if (target !== currentVersion || target.status !== "published") return { ok: false, code: "ALREADY_DECIDED" };
      transition(target, "revoked");
      return { ok: true, value: { revoked: cloneVersion(target), restored: cloneVersion(restored) } };
    },
    addAudit(entry) {
      options.writeAudit?.(entry);
      audit.push({ id: nextAuditId, at: now().toISOString(), ...entry });
      nextAuditId += 1;
    },
    auditLog() {
      return [...audit].sort((left, right) => right.id - left.id);
    },
  };
}
