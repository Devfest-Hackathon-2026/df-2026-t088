import { Button } from "../components/Button";
import type { AuditEntry } from "./api";
import { RESEARCH_COPY as C } from "./copy";
import { STEP } from "./use-loop";
import type { Notice } from "./use-loop";
import { StepNotice } from "./StepNotice";

const ACTION_LABEL: Record<AuditEntry["action"], string> = {
  query: "記録を読んだ", suggest: "案をつくった", decide: "案を決めた", revoke: "承認を取り消した", "audit-read": "操作の記録を読んだ",
};
const RESULT_LABEL = { allowed: "できた", denied: "断られた" } as const;


// 承認の記録は「approved;candidate:番号;source:出どころ」の形で残る（#154）
function detailLabel(detail: string): string {
  const chosen = /^approved;candidate:(\d+);source:(gemini|table)$/.exec(detail);
  if (chosen) return `承認・案 ${chosen[1]}（${chosen[2] === "gemini" ? "Gemini" : "表"}）`;
  return detail === "approved" ? "承認" : detail === "rejected" ? "断る" : detail === "revoked" ? "取り消し" : detail;
}

export function AuditTable({ entries, onLoad, notice }: { entries: AuditEntry[]; onLoad: () => void; notice: Notice | null }) {
  return (
    <section className="audit" aria-labelledby="audit-title">
      <h2 id="audit-title">{C.auditTitle}</h2>
      <p className="note">{C.auditNote}</p>
      <Button onClick={onLoad}>{C.auditRead}</Button>
      <StepNotice notice={notice} step={STEP.audit} />
      <p className="audit__hint note">{C.auditScrollHint}</p>
      {/* 幅の小さい画面で、表だけを横に動かせる枠にする。キーボードでも動かせるよう、フォーカスを受ける */}
      <div className="audit__scroll" role="region" aria-label={C.auditRegionName} tabIndex={0}>
        {entries.length === 0 ? (
          <p className="note">{C.auditEmpty}</p>
        ) : (
          <table aria-label={C.auditTableName}>
            <thead>
              <tr>
                {["時刻", "役割", "したこと", "対象", "理由", "結果"].map((name) => <th key={name} scope="col">{name}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className={entry.result === "denied" ? "is-denied" : undefined}>
                  <td>{new Date(entry.at).toLocaleTimeString("ja-JP")}</td>
                  <td>{C.roles[entry.role]}</td>
                  <td>{ACTION_LABEL[entry.action]}{entry.detail ? `（${detailLabel(entry.detail)}）` : ""}</td>
                  <td>{entry.targetId ?? "—"}</td>
                  <td>{entry.reason ?? "—"}</td>
                  <td>{RESULT_LABEL[entry.result]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
