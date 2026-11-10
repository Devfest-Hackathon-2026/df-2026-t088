import { randomUUID } from "node:crypto";
import { getGoogleAccessToken } from "../gcp/access-token.ts";
import { DEMO_WORKSPACE_ID } from "../workspace/store.ts";
import type { PrintProblem } from "./validate.ts";
import { printTemplate } from "./templates.ts";

/** teacher：先生が確かめて配った（古い保存もこちら）。child：子どもが自分で撮った。先生は確かめていない */
export type HandoutOrigin = "teacher" | "child";
export type PrintHandout = { id: string; templateId: PrintProblem["templateId"]; questionText: string; params: Record<string, unknown>; createdAt: string; origin: HandoutOrigin };
/** 応答に出す形。origin は先生の一覧だけに出すので、ほかの応答では外す */
export type PublicPrintHandout = Omit<PrintHandout, "origin">;
export function publicHandout({ origin: _origin, ...rest }: PrintHandout): PublicPrintHandout { return rest; }
// 配った説明は学級ごとに持つ。応答の PrintHandout に学級の id は出さない（docs/product/education-api-contract.md「学級（ワークスペース）の API」）
export type PrintHandoutsStore = {
  /** 既定では、子どもが撮ったものを含めない（先生の一覧だけ includeChild を付ける） */
  list(workspaceId: string, options?: { includeChild?: boolean }): Promise<PrintHandout[]>;
  get(id: string): Promise<PrintHandout | undefined>;
  /** 説明の id から学級の id を引く内部用の関数（応答の PrintHandout には学級の id を出さない）。見つからなければ undefined */
  workspaceIdOf(id: string): Promise<string | undefined>;
  add(problem: PrintProblem, workspaceId: string, origin?: HandoutOrigin): Promise<PrintHandout>;
  /** ほかの学級のものは消さず false */
  remove(id: string, workspaceId: string): Promise<boolean>;
};

const MAX_HANDOUTS = 50; // 1 つの学級に残す数。子どもが撮った分も含める

/**
 * 新しい順の一覧のうち、上限を超えて外すもの。子どもが撮った説明を古い順に先に外し、足りなければ古いものから外す
 * （子どもの撮影が、先生が配った説明を押し出さないため）
 */
function evictions(newestFirst: StoredHandout[]): StoredHandout[] {
  let excess = newestFirst.length - MAX_HANDOUTS;
  if (excess <= 0) return [];
  const oldestFirst = [...newestFirst].reverse();
  const out = oldestFirst.filter((item) => item.handout.origin === "child").slice(0, excess);
  excess -= out.length;
  if (excess > 0) out.push(...oldestFirst.filter((item) => !out.includes(item)).slice(0, excess));
  return out;
}
const visible = (items: StoredHandout[], includeChild: boolean | undefined) => items.filter((item) => includeChild === true || item.handout.origin !== "child");
const identifier = /^[A-Za-z0-9_-]+$/;

export type FirestoreHandoutsConfig = { project?: string; database?: string; fetcher?: typeof fetch; now?: () => Date };

type StoredHandout = { handout: PrintHandout; workspaceId: string };

export function createPrintHandoutsStore(now: () => Date = () => new Date()): PrintHandoutsStore {
  const items: StoredHandout[] = [];
  return {
    async list(workspaceId, options) { return visible(items.filter((item) => item.workspaceId === workspaceId), options?.includeChild).map((item) => copyHandout(item.handout)).reverse(); },
    async get(id) {
      const found = items.find((item) => item.handout.id === id);
      return found ? copyHandout(found.handout) : undefined;
    },
    async workspaceIdOf(id) { return items.find((item) => item.handout.id === id)?.workspaceId; },
    async add(problem, workspaceId, origin = "teacher") {
      const handout: PrintHandout = { id: randomUUID(), templateId: problem.templateId, questionText: problem.questionText, params: structuredClone(problem.params), createdAt: now().toISOString(), origin };
      items.push({ handout, workspaceId });
      // 多くなったら、その学級の分から外す（子どもが撮った分が先）
      const own = items.filter((item) => item.workspaceId === workspaceId).reverse();
      for (const old of evictions(own)) items.splice(items.indexOf(old), 1);
      return copyHandout(handout);
    },
    async remove(id, workspaceId) {
      const index = items.findIndex((item) => item.handout.id === id && item.workspaceId === workspaceId);
      if (index < 0) return false;
      items.splice(index, 1);
      return true;
    },
  };
}

export function createFirestorePrintHandoutsStore(config: FirestoreHandoutsConfig): PrintHandoutsStore {
  const { project, database, fetcher = fetch, now = () => new Date() } = config;
  if (!project || !identifier.test(project)) throw new Error("Firestore project is not configured");
  if (!database || (database !== "(default)" && !identifier.test(database))) throw new Error("Firestore database is not configured");
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents`;
  const documentUrl = (id: string) => `${baseUrl}/printHandouts/${encodeURIComponent(id)}`;
  const newestFirst = (left: StoredHandout, right: StoredHandout) => right.handout.createdAt.localeCompare(left.handout.createdAt);

  // 学級の説明を、新しい順にすべて読む。workspaceId だけの一致検索なので、複合インデックスは要らない
  // demo だけは、workspaceId の無い古い文書（学級を入れる前に配ったもの）も含める
  async function listStored(workspaceId: string): Promise<StoredHandout[]> {
    const query = await firestoreRequest(fetcher, "POST", `${baseUrl}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: "printHandouts" }],
        where: { fieldFilter: { field: { fieldPath: "workspaceId" }, op: "EQUAL", value: { stringValue: workspaceId } } },
        limit: MAX_HANDOUTS * 2,
      },
    }) as { document?: FirestoreDocument }[];
    const found = (Array.isArray(query) ? query : []).flatMap((row) => (row.document ? readHandout(row.document) : []));
    if (workspaceId === DEMO_WORKSPACE_ID) {
      const legacy = await firestoreRequest(fetcher, "GET", `${baseUrl}/printHandouts?pageSize=${MAX_HANDOUTS * 2}&orderBy=createdAt%20desc`) as { documents?: FirestoreDocument[] };
      for (const item of (legacy.documents ?? []).flatMap(readHandout)) {
        if (item.workspaceId === DEMO_WORKSPACE_ID && !found.some((other) => other.handout.id === item.handout.id)) found.push(item);
      }
    }
    return found.filter((item) => item.workspaceId === workspaceId).sort(newestFirst);
  }

  async function removeDocument(id: string): Promise<boolean> {
    const response = await firestoreRawRequest(fetcher, "DELETE", documentUrl(id));
    if (response.status === 404) return false;
    if (!response.ok) throw new Error("Firestore request failed");
    return true;
  }

  return {
    async list(workspaceId, options) {
      const stored = await listStored(workspaceId);
      const dropped = new Set(evictions(stored));
      return visible(stored.filter((item) => !dropped.has(item)), options?.includeChild).map((item) => item.handout);
    },
    async get(id) {
      const response = await firestoreRawRequest(fetcher, "GET", documentUrl(id));
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error("Firestore request failed");
      return readHandout(await response.json() as FirestoreDocument)[0]?.handout;
    },
    async workspaceIdOf(id) {
      const response = await firestoreRawRequest(fetcher, "GET", documentUrl(id));
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error("Firestore request failed");
      return readHandout(await response.json() as FirestoreDocument)[0]?.workspaceId;
    },
    async add(problem, workspaceId, origin = "teacher") {
      const item: PrintHandout = { id: randomUUID(), templateId: problem.templateId, questionText: problem.questionText, params: structuredClone(problem.params), createdAt: now().toISOString(), origin };
      await firestoreRequest(fetcher, "PATCH", documentUrl(item.id), {
        fields: encodeFields({ id: item.id, templateId: item.templateId, questionText: item.questionText, params: item.params, createdAt: item.createdAt, workspaceId, origin }),
      });
      const oldItems = evictions(await listStored(workspaceId));
      await Promise.all(oldItems.map((old) => removeDocument(old.handout.id)));
      return copyHandout(item);
    },
    async remove(id, workspaceId) {
      const response = await firestoreRawRequest(fetcher, "GET", documentUrl(id));
      if (response.status === 404) return false;
      if (!response.ok) throw new Error("Firestore request failed");
      const stored = readHandout(await response.json() as FirestoreDocument)[0];
      if (!stored || stored.workspaceId !== workspaceId) return false;
      return removeDocument(id);
    },
  };
}

type FirestoreValue = Record<string, any>;
type FirestoreDocument = { name?: unknown; fields?: Record<string, FirestoreValue> };

function copyHandout(item: PrintHandout): PrintHandout {
  return { ...item, params: structuredClone(item.params) };
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  throw new Error("Firestore value is invalid");
}

function encodeFields(value: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
}

function decodeValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

// workspaceId の無い文書は、学級を入れる前に配ったもの。demo として読む
function readHandout(document: FirestoreDocument): StoredHandout[] {
  if (typeof document.name !== "string" || !document.fields) return [];
  const fields = decodeFields(document.fields);
  const id = document.name.split("/").at(-1);
  if (!id || typeof fields.templateId !== "string" || typeof fields.questionText !== "string" || typeof fields.createdAt !== "string" || typeof fields.params !== "object" || fields.params === null || Array.isArray(fields.params)) return [];
  const template = printTemplate(fields.templateId);
  if (!template) return [];
  const workspaceId = typeof fields.workspaceId === "string" && fields.workspaceId !== "" ? fields.workspaceId : DEMO_WORKSPACE_ID;
  // origin の無い古い文書は、先生が配ったもの
  const origin: HandoutOrigin = fields.origin === "child" ? "child" : "teacher";
  return [{ workspaceId, handout: { id, templateId: template.id, questionText: fields.questionText, params: fields.params as Record<string, unknown>, createdAt: fields.createdAt, origin } }];
}

async function firestoreRawRequest(fetcher: typeof fetch, method: string, url: string, body?: unknown): Promise<Response> {
  const token = await getGoogleAccessToken(fetcher, "Firestore");
  return fetcher(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8_000),
  });
}

async function firestoreRequest(fetcher: typeof fetch, method: string, url: string, body?: unknown): Promise<unknown> {
  const response = await firestoreRawRequest(fetcher, method, url, body);
  if (!response.ok) throw new Error("Firestore request failed");
  return response.status === 204 ? undefined : response.json();
}
