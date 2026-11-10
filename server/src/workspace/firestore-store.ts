// 学級の保存（Firestore 版）。読む側は同期のまま（WorkspaceStore を変えない）にするため、
// メモリに写しを持ち、変えるたびに Firestore へ順番に書く。起動時に全部読み込み、終わるまで ready() は解けない。
// 持ち主はメールから作った印（ownerSub）だけで、メールは保存しない。
import { getGoogleAccessToken } from "../gcp/access-token.ts";
import { createMemoryWorkspaceStore, jstDay, readReadsPerDay, type MemoryWorkspaceOptions, type Workspace, type WorkspaceSeed, type WorkspaceStore } from "./store.ts";

/** 起動時の読み込みの入口がある保存。読み込みが終わるまで中身を使ってはいけない */
export type PersistentWorkspaceStore = WorkspaceStore & {
  /** 読み込み済みなら即解ける。失敗したら reject し、次に呼んだときもういちど読む */
  ready(): Promise<void>;
  /** 書き込み待ちが全部終わるまで待つ（試験と終了時用） */
  flush(): Promise<void>;
};

export type FirestoreWorkspaceConfig = {
  project?: string;
  database?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
} & Pick<MemoryWorkspaceOptions, "maxWorkspaces" | "readsPerDay">;

const identifier = /^[A-Za-z0-9_-]+$/;
const PAGE_SIZE = 300;
const MAX_READ_DOCUMENTS = 5000;

type FirestoreValue = { stringValue?: string; integerValue?: string; booleanValue?: boolean };
type FirestoreDocument = { name?: unknown; fields?: Record<string, FirestoreValue> };

/** PRINT_FIRESTORE_DATABASE と GOOGLE_CLOUD_PROJECT が両方あるときだけ Firestore 版。なければ今のメモリ版 */
export function createWorkspaceStoreFromEnv(env: NodeJS.ProcessEnv, fetcher?: typeof fetch): WorkspaceStore {
  const database = env.PRINT_FIRESTORE_DATABASE?.trim();
  const project = env.GOOGLE_CLOUD_PROJECT?.trim();
  const readsPerDay = readReadsPerDay(env);
  if (!database || !project) return createMemoryWorkspaceStore({ readsPerDay });
  return createFirestoreWorkspaceStore({ project, database, fetcher, readsPerDay });
}

export function isPersistent(store: WorkspaceStore): store is PersistentWorkspaceStore {
  return typeof (store as Partial<PersistentWorkspaceStore>).ready === "function";
}

export function createFirestoreWorkspaceStore(config: FirestoreWorkspaceConfig): PersistentWorkspaceStore {
  const { project, database, fetcher = fetch, now = () => new Date() } = config;
  if (!project || !identifier.test(project)) throw new Error("Firestore project is not configured");
  if (!database || (database !== "(default)" && !identifier.test(database))) throw new Error("Firestore database is not configured");
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents`;

  let inner: WorkspaceStore | undefined;
  let loading: Promise<void> | undefined;
  let tail: Promise<void> = Promise.resolve();
  let failedWrites = 0;

  // 同期の関数からは待てないので、順番に並べて後ろで送る。失敗しても要求は落とさず、件数だけ残す
  // 書くのは毎回その学級の全項目（回数なら今の値）なので、あとの書き込みが成功すれば前の失敗は直る
  const enqueue = (write: () => Promise<unknown>): void => {
    tail = tail.then(write).then(
      () => undefined,
      () => {
        failedWrites += 1;
        console.error(`workspace store: Firestore write failed (${failedWrites} so far)`);
      },
    );
  };

  async function load(): Promise<void> {
    const workspaces: WorkspaceSeed["workspaces"] = [];
    let pageToken = "";
    do {
      const page = await firestoreRequest(fetcher, "GET", `${baseUrl}/workspaces?pageSize=${PAGE_SIZE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`) as { documents?: FirestoreDocument[]; nextPageToken?: unknown };
      for (const document of page.documents ?? []) {
        const read = readWorkspace(document);
        if (read) workspaces.push(read);
      }
      pageToken = typeof page.nextPageToken === "string" ? page.nextPageToken : "";
    } while (pageToken);

    // 今日の分だけ読む。day だけの一致検索なので、複合インデックスは要らない
    const day = jstDay(now());
    const rows = await firestoreRequest(fetcher, "POST", `${baseUrl}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: "workspaceReads" }],
        where: { fieldFilter: { field: { fieldPath: "day" }, op: "EQUAL", value: { stringValue: day } } },
        limit: MAX_READ_DOCUMENTS,
      },
    }) as { document?: FirestoreDocument }[];
    const reads = (Array.isArray(rows) ? rows : []).flatMap((row) => (row.document ? readCount(row.document) : []));

    inner = createMemoryWorkspaceStore({
      maxWorkspaces: config.maxWorkspaces,
      readsPerDay: config.readsPerDay,
      seed: { workspaces, reads },
      hooks: {
        created: (ownerSub, workspace) => enqueue(() => writeWorkspace(ownerSub, workspace)),
        renamed: (ownerSub, workspace) => enqueue(() => writeWorkspace(ownerSub, workspace)),
        childCaptureSet: (ownerSub, workspace) => enqueue(() => writeWorkspace(ownerSub, workspace)),
        read: (workspaceId, readDay, count) => enqueue(() => writeCount(workspaceId, readDay, count)),
      },
    });
  }

  const writeWorkspace = (ownerSub: string, workspace: Workspace) =>
    firestoreRequest(fetcher, "PATCH", `${baseUrl}/workspaces/${encodeURIComponent(workspace.id)}`, {
      fields: { ownerSub: str(ownerSub), name: str(workspace.name), joinCode: str(workspace.joinCode), createdAt: str(workspace.createdAt), childCapture: { booleanValue: workspace.childCapture } },
    });

  const writeCount = (workspaceId: string, day: string, count: number) =>
    firestoreRequest(fetcher, "PATCH", `${baseUrl}/workspaceReads/${encodeURIComponent(`${workspaceId}_${day}`)}`, {
      fields: { workspaceId: str(workspaceId), day: str(day), count: { integerValue: String(count) } },
    });

  const loaded = (): WorkspaceStore => {
    if (!inner) throw new Error("workspace store is not loaded");
    return inner;
  };

  return {
    ready() {
      if (inner) return Promise.resolve();
      loading ??= load().catch((error) => {
        loading = undefined;
        throw error;
      });
      return loading;
    },
    flush: () => tail,
    byOwner: (ownerSub) => loaded().byOwner(ownerSub),
    byJoinCode: (code) => loaded().byJoinCode(code),
    ensureFor: (ownerSub, at) => loaded().ensureFor(ownerSub, at),
    rename: (ownerSub, name) => loaded().rename(ownerSub, name),
    setChildCapture: (ownerSub, on) => loaded().setChildCapture(ownerSub, on),
    countRead: (workspaceId, at) => loaded().countRead(workspaceId, at),
  };
}

const str = (value: string): FirestoreValue => ({ stringValue: value });

function readWorkspace(document: FirestoreDocument): { ownerSub: string; workspace: Workspace } | undefined {
  const id = typeof document.name === "string" ? document.name.split("/").at(-1) : undefined;
  const fields = document.fields;
  const ownerSub = fields?.ownerSub?.stringValue;
  const name = fields?.name?.stringValue;
  const joinCode = fields?.joinCode?.stringValue;
  const createdAt = fields?.createdAt?.stringValue;
  if (!id || !ownerSub || !name || !joinCode || !createdAt) return undefined;
  // childCapture の無い古い文書は切として読む
  return { ownerSub, workspace: { id, name, joinCode, createdAt, childCapture: fields?.childCapture?.booleanValue === true } };
}

function readCount(document: FirestoreDocument): { workspaceId: string; day: string; count: number }[] {
  const workspaceId = document.fields?.workspaceId?.stringValue;
  const day = document.fields?.day?.stringValue;
  const count = Number(document.fields?.count?.integerValue);
  if (!workspaceId || !day || !Number.isSafeInteger(count) || count < 0) return [];
  return [{ workspaceId, day, count }];
}

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
