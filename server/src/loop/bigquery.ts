import { createHash } from "node:crypto";
import { getGoogleAccessToken } from "../gcp/access-token.ts";
import type { Stumble } from "./store.ts";

export type BigQueryConfig = {
  dataset?: string;
  project?: string;
  schoolId?: string;
  fetcher?: typeof fetch;
};

export type BigQueryStumbleRow = {
  lessonKey: string;
  problem: string;
  pattern: string;
  hintsShown: number;
  occurredAt: string;
  schoolHash: string;
  source: string;
};

const DEFAULT_SCHOOL_ID = "demo-school-1";
const identifier = /^[A-Za-z0-9_-]+$/;

export function buildStumbleRow(stumble: Stumble, schoolId = DEFAULT_SCHOOL_ID): BigQueryStumbleRow {
  return {
    lessonKey: stumble.lessonKey,
    problem: stumble.problem,
    pattern: stumble.pattern,
    hintsShown: stumble.hintsShown,
    occurredAt: stumble.occurredOn,
    schoolHash: createHash("sha256").update(schoolId).digest("hex"),
    source: stumble.source,
  };
}

function getSetup(config: BigQueryConfig): { project: string; dataset: string; fetcher: typeof fetch } {
  if (!config.project || !identifier.test(config.project)) throw new Error("BigQuery project is not configured");
  if (!config.dataset || !identifier.test(config.dataset)) throw new Error("BigQuery dataset is not configured");
  return { project: config.project, dataset: config.dataset, fetcher: config.fetcher ?? fetch };
}

async function requestBigQuery(config: BigQueryConfig, path: string, body?: unknown): Promise<unknown> {
  const { project, fetcher } = getSetup(config);
  const token = await getGoogleAccessToken(fetcher, "BigQuery");
  const response = await fetcher(`https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(project)}/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("BigQuery request failed");
  const result: unknown = await response.json();
  if (typeof result === "object" && result !== null && "insertErrors" in result && Array.isArray((result as { insertErrors: unknown[] }).insertErrors) && (result as { insertErrors: unknown[] }).insertErrors.length > 0) {
    throw new Error("BigQuery insert returned errors");
  }
  return result;
}

export async function insertStumble(config: BigQueryConfig, stumble: Stumble): Promise<void> {
  if (!config.dataset) return;
  const row = buildStumbleRow(stumble, config.schoolId?.trim() || DEFAULT_SCHOOL_ID);
  await requestBigQuery(config, `datasets/${encodeURIComponent(config.dataset)}/tables/stumbles/insertAll`, {
    rows: [{ json: row }], skipInvalidRows: false, ignoreUnknownValues: false,
  });
}

export type RegionStumble = { lessonKey: string; problem: string; pattern: string; count: number };

export async function readRegionSummary(config: BigQueryConfig): Promise<RegionStumble[]> {
  const { project, dataset } = getSetup(config);
  const result = await requestBigQuery(config, "queries", {
    query: `SELECT lessonKey, problem, pattern, count FROM \`${project}.${dataset}.stumbles_by_unit\` ORDER BY count DESC, lessonKey, problem, pattern LIMIT 100`,
    useLegacySql: false,
    timeoutMs: 8_000,
  }) as { rows?: { f?: { v?: unknown }[] }[] };
  return (result.rows ?? []).flatMap((row) => {
    const fields = row.f;
    const [lessonKey, problem, pattern, count] = fields?.map((field) => field.v) ?? [];
    const numericCount = typeof count === "string" ? Number(count) : count;
    if (typeof lessonKey !== "string" || typeof problem !== "string" || typeof pattern !== "string" || typeof numericCount !== "number" || !Number.isInteger(numericCount)) return [];
    return [{ lessonKey, problem, pattern, count: numericCount }];
  });
}
