export const PRINT_DEMAND_UNITS = [
  { id: "sansu-6-01", name: "算数 6 年 分数の乗法及び除法" },
  { id: "sansu-6-02", name: "算数 6 年 数量の関係を表す式" },
  { id: "sansu-6-03", name: "算数 6 年 平面図形" },
  { id: "sansu-6-04", name: "算数 6 年 身の回りにある形やおよその面積" },
  { id: "sansu-6-05", name: "算数 6 年 平面図形の面積" },
  { id: "sansu-6-06", name: "算数 6 年 立体図形の体積" },
  { id: "sansu-6-07", name: "算数 6 年 伴って変わる二つの数量" },
  { id: "sansu-6-08", name: "算数 6 年 二つの数量の関係" },
  { id: "sansu-6-09", name: "算数 6 年 データの収集と分析" },
  { id: "sansu-6-10", name: "算数 6 年 起こり得る場合" },
  { id: "rika-6-01", name: "理科 6 年 燃焼の仕組み" },
  { id: "rika-6-02", name: "理科 6 年 生物と環境" },
  { id: "rika-6-03", name: "理科 6 年 人の体のつくりと働き" },
  { id: "rika-6-04", name: "理科 6 年 植物の養分と水の通り道" },
  { id: "rika-6-05", name: "理科 6 年 月と太陽" },
  { id: "rika-6-06", name: "理科 6 年 土地のつくりと変化" },
  { id: "rika-6-07", name: "理科 6 年 てこの規則性" },
  { id: "rika-6-08", name: "理科 6 年 水溶液の性質" },
  { id: "rika-6-09", name: "理科 6 年 電気の利用" },
  // 型「分数のたし算・ひき算」の範囲の外（帯分数・3 つ以上・かけ算わり算など）が、まだ対応していない需要として数えられる
  { id: "sansu-5-fraction", name: "算数 5 年 分数の計算（まだ対応していない形）" },
] as const;

export type PrintDemandUnitId = typeof PRINT_DEMAND_UNITS[number]["id"] | "other";

const unitById = new Map<string, typeof PRINT_DEMAND_UNITS[number]>(PRINT_DEMAND_UNITS.map((unit) => [unit.id, unit]));

export function printDemandUnitId(value: unknown): PrintDemandUnitId {
  return typeof value === "string" && unitById.has(value) ? value as PrintDemandUnitId : "other";
}

export function printDemandUnitName(id: PrintDemandUnitId): string {
  return id === "other" ? "その他" : unitById.get(id)!.name;
}

export type PrintDemandItem = { unitId: PrintDemandUnitId; unitName: string; count: number };

export type FirestoreDemandConfig = { project?: string; database?: string; fetcher?: typeof fetch };

/** 問題文や写真を持たず、単元ごとの件数と最後の日時だけを保存する。 */
export class PrintDemandStore {
  private readonly counts = new Map<PrintDemandUnitId, { count: number; lastSeenAt: string }>();
  private readonly firestore?: { baseUrl: string; fetcher: typeof fetch };

  constructor(config?: FirestoreDemandConfig) {
    if (!config) return;
    if (!config.project || !/^[A-Za-z0-9_-]+$/.test(config.project)) throw new Error("Firestore project is not configured");
    if (!config.database || (config.database !== "(default)" && !/^[A-Za-z0-9_-]+$/.test(config.database))) throw new Error("Firestore database is not configured");
    this.firestore = {
      baseUrl: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.project)}/databases/${encodeURIComponent(config.database)}/documents`,
      fetcher: config.fetcher ?? fetch,
    };
  }

  async record(unitId: PrintDemandUnitId, at = new Date()): Promise<void> {
    if (this.firestore) {
      const { baseUrl, fetcher } = this.firestore;
      await firestoreRequest(fetcher, "POST", `${baseUrl}:commit`, {
        writes: [{
          update: {
            // commit の文書名はリソース名（URL の頭を付けない）
            name: `${baseUrl.replace(/^https:\/\/firestore\.googleapis\.com\/v1\//, "")}/printDemand/${encodeURIComponent(unitId)}`,
            fields: { unitId: { stringValue: unitId }, lastSeenAt: { stringValue: at.toISOString() } },
          },
          updateTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
        }],
      });
      return;
    }
    const previous = this.counts.get(unitId);
    this.counts.set(unitId, { count: (previous?.count ?? 0) + 1, lastSeenAt: at.toISOString() });
  }

  async list(): Promise<PrintDemandItem[]> {
    if (this.firestore) {
      const result = await firestoreRequest(this.firestore.fetcher, "GET", `${this.firestore.baseUrl}/printDemand?pageSize=100`) as { documents?: { name?: unknown; fields?: Record<string, { stringValue?: unknown; integerValue?: unknown }> }[] };
      return (result.documents ?? []).flatMap((document) => {
        const id = typeof document.name === "string" ? document.name.split("/").at(-1) : undefined;
        const unitId = printDemandUnitId(document.fields?.unitId?.stringValue ?? id);
        const rawCount = document.fields?.count?.integerValue;
        const count = typeof rawCount === "string" ? Number(rawCount) : NaN;
        return Number.isSafeInteger(count) && count > 0 ? [{ unitId, unitName: printDemandUnitName(unitId), count }] : [];
      }).sort((left, right) => right.count - left.count || left.unitId.localeCompare(right.unitId));
    }
    return [...this.counts.entries()]
      .sort(([leftId, left], [rightId, right]) => right.count - left.count || leftId.localeCompare(rightId))
      .map(([unitId, value]) => ({ unitId, unitName: printDemandUnitName(unitId), count: value.count }));
  }
}
import { getGoogleAccessToken } from "../gcp/access-token.ts";


async function firestoreRequest(fetcher: typeof fetch, method: string, url: string, body?: unknown): Promise<unknown> {
  const token = await getGoogleAccessToken(fetcher, "Firestore");
  const response = await fetcher(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Firestore request failed");
  return response.status === 204 ? undefined : response.json();
}
