import type { StudioLesson } from "./lesson-ir.ts";

export type EvidenceSource = "measured" | "dummy" | "simulation" | "mock";

export type StudioGenerationEvidence = {
  model: string;
  elapsedMs: number;
  source: EvidenceSource;
};

export type StudioEvidenceVersion = {
  id: string;
  lessonId: string;
  number: number;
  baseVersion: number | null;
  status: string;
  transitions: string[];
  lesson: StudioLesson;
  validation: { ok: boolean };
  createdAt: string;
  isFixture: boolean;
  generation?: StudioGenerationEvidence;
  comparedToVersion?: number | null;
  approvalHistory?: { decision: "approved" | "rejected" | "revoked"; at: string; reason: string }[];
};

export type StudioEvidenceMetrics = {
  generationCount: number;
  validationPassRate: number | null;
  approvalRate: number | null;
  generationTimeP50Ms: number | null;
  generationTimeP95Ms: number | null;
};

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(fraction * ordered.length) - 1] ?? null;
}

export function summarizeStudioEvidence(versions: StudioEvidenceVersion[]): StudioEvidenceMetrics {
  const checked = versions.filter((version) => typeof version.validation?.ok === "boolean");
  const decided = versions.filter((version) => ["approved", "published", "rejected", "revoked"].includes(version.status));
  const generationTimes = versions.flatMap((version) => {
    const duration = version.generation?.elapsedMs;
    return Number.isFinite(duration) && duration! >= 0 ? [duration!] : [];
  });
  const approvals = decided.filter((version) => ["approved", "published", "revoked"].includes(version.status)).length;

  return {
    generationCount: versions.length,
    validationPassRate: checked.length ? checked.filter((version) => version.validation.ok).length / checked.length : null,
    approvalRate: decided.length ? approvals / decided.length : null,
    generationTimeP50Ms: percentile(generationTimes, 0.5),
    generationTimeP95Ms: percentile(generationTimes, 0.95),
  };
}
