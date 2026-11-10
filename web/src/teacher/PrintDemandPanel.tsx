import { useEffect, useState } from "react";
import { AdminApiError, readPrintDemand, type PrintDemand } from "./api";
import { useApproverKey } from "./approver-key";
import "./PrintDemandPanel.css";

const LIMIT = 5;

export function PrintDemandPanel() {
  const [items, setItems] = useState<PrintDemand[]>([]);
  const [failed, setFailed] = useState<"none" | "key" | "other">("none");
  // 承認キーを入れたら読み直す（キーが無いと 401 で断られる）
  const approverKey = useApproverKey();

  useEffect(() => {
    let active = true;
    void readPrintDemand().then(({ items: next }) => {
      if (!active) return;
      setFailed("none");
      setItems([...next].sort((left, right) => right.count - left.count || left.unitId.localeCompare(right.unitId)).slice(0, LIMIT));
    }).catch((error: unknown) => {
      if (active) setFailed(error instanceof AdminApiError && (error.status === 401 || error.status === 403) ? "key" : "other");
    });
    return () => { active = false; };
  }, [approverKey]);

  return (
    <section className="print-demand" aria-labelledby="print-demand-title">
      <div className="print-demand__heading">
        <h2 id="print-demand-title">プリントで撮られた、説明がまだ無い単元</h2>
        <p>説明をつくると、子どもが撮ったときに動く説明が出せます</p>
      </div>
      {failed === "key" ? <p role="status">画面の上の「承認キー」を入れてください</p>
        : failed === "other" ? <p role="status">需要を読み込めませんでした</p> : items.length === 0 ? <p>まだありません</p> : (
        <ol className="print-demand__list">
          {items.map((item) => <li key={item.unitId}><span>{item.unitName}</span><span>{item.count}回</span></li>)}
        </ol>
      )}
    </section>
  );
}
