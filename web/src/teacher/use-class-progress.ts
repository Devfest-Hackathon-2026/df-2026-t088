// 保存した子どもの進み（仮の API）を読む。学級のようす（表）と、子どもの進み（一人）が同じ読み方を使う
import { useEffect, useMemo, useState } from "react";
import type { SubjectId } from "../data/types";
import { AdminApiError, readClassProgress } from "./api";
import { classProgressFrom, type ClassProgress } from "./progress-model";

export type ClassProgressState = { status: "loading" } | { status: "error"; code: string } | { status: "ready"; progress: ClassProgress };

type Loaded = { status: "loading" } | { status: "error"; code: string } | { status: "ready"; now: string; students: Parameters<typeof classProgressFrom>[1] };

const errorCode = (error: unknown) => (error instanceof AdminApiError ? error.code : "NETWORK");

/** 教科を替えても読み直さない。API は全部の章の done を返すので、選んだ教科の章だけを拾う */
export function useClassProgress(reloadKey: number, subjectId: SubjectId = "sansu"): ClassProgressState {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    setLoaded({ status: "loading" });
    readClassProgress()
      .then((result) => {
        if (alive) setLoaded({ status: "ready", now: result.now, students: result.students });
      })
      .catch((error: unknown) => {
        if (alive) setLoaded({ status: "error", code: errorCode(error) });
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  return useMemo<ClassProgressState>(
    () => (loaded.status === "ready" ? { status: "ready", progress: classProgressFrom(loaded.now, loaded.students, subjectId) } : loaded),
    [loaded, subjectId],
  );
}
