import { useEffect, useState } from "react";

/** 767px 以下か。盤面の1行のマスの数を切り替える（D-237）。matchMedia が無い環境は 768px 以上として扱う */
export const NARROW_QUERY = "(max-width: 767px)";

const readNarrow = (): boolean => typeof matchMedia === "function" && matchMedia(NARROW_QUERY).matches;

/** 幅が 767px 以下か。最初の描画から正しく、幅が変わったら更新する */
export function useNarrowBoard(): boolean {
  const [narrow, setNarrow] = useState(readNarrow);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const list = matchMedia(NARROW_QUERY);
    const update = () => setNarrow(readNarrow());
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return narrow;
}
