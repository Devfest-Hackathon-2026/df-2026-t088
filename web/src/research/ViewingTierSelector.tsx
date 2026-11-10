import { useEffect, useState } from "react";
import type { Role, Scope } from "./api";
import { TIER_COPY } from "./copy";

type TierId = keyof typeof TIER_COPY.access;

const VIEWING_TIERS: { id: TierId; available: boolean; storage: string; visible: string; hidden: string; protection: string }[] = [
  { id: "personal", available: false, storage: "端末の中（server に送らない）", visible: "自分がよく間違える形", hidden: "ほかの子の記録", protection: "記録を端末の外へ送りません" },
  { id: "classRecords", available: true, storage: "server", visible: "問題・型・見たヒントの数・日付", hidden: "名前・番号・時刻・答えの文字", protection: "名前などを記録せず、5 件未満の型を出しません" },
  { id: "lessonSummary", available: true, storage: "server", visible: "問題ごとの件数と型の内訳、ヒントの前後の比べ", hidden: "1 件ずつの記録、5 件未満の型", protection: "5 件未満の型を出しません" },
  { id: "schoolSummary", available: false, storage: "まだありません", visible: "学年や地域で弱い単元", hidden: "学校名がわかる小さな集計", protection: "小さな集計から学校名がわからないようにします" },
];

export function ViewingTierSelector({ role, scope, onScopeChange }: { role: Role; scope: Scope; onScopeChange: (scope: Scope) => void }) {
  const [selected, setSelected] = useState<TierId>("lessonSummary");
  useEffect(() => {
    setSelected((current) => current === "classRecords" || current === "lessonSummary"
      ? scope === "records" ? "classRecords" : "lessonSummary"
      : current);
  }, [scope]);
  const tier = VIEWING_TIERS.find((item) => item.id === selected);
  const access = TIER_COPY.access[selected];
  if (!tier) return null;

  const canView = access.roles.includes(role);
  return (
    <section className="viewing-tiers" aria-labelledby="viewing-tiers-title">
      <h2 id="viewing-tiers-title">{TIER_COPY.title}</h2>
      <p className="note">{TIER_COPY.lead}</p>
      <fieldset className="viewing-tiers__choices">
        <legend>{TIER_COPY.title}</legend>
        {VIEWING_TIERS.map((item) => (
          <label key={item.id} className={`viewing-tier${item.available ? "" : " viewing-tier--planned"}`}>
            <input type="radio" name="viewing-tier" value={item.id} checked={selected === item.id} onChange={() => {
              setSelected(item.id);
              if (item.id === "classRecords") onScopeChange("records");
              if (item.id === "lessonSummary") onScopeChange("summary");
            }} />
            <span>{TIER_COPY.names[item.id]}</span>
            {!item.available && <span className="viewing-tier__status">{TIER_COPY.planned}</span>}
          </label>
        ))}
      </fieldset>
      <section className="viewing-tiers__detail" aria-live="polite" aria-labelledby="viewing-tier-detail-title">
        <h3 id="viewing-tier-detail-title">{TIER_COPY.names[selected]}</h3>
        {!tier.available && <p className="viewing-tiers__planned-note">{TIER_COPY.planned}</p>}
        {tier.available && !canView && <p className="viewing-tiers__denied" role="status">{TIER_COPY.roleDenied}</p>}
        <dl>
          <div><dt>{TIER_COPY.storage}</dt><dd>{tier.storage}</dd></div>
          <div><dt>{TIER_COPY.visible}</dt><dd>{tier.visible}</dd></div>
          <div><dt>{TIER_COPY.hidden}</dt><dd>{tier.hidden}</dd></div>
          <div><dt>{TIER_COPY.audience}</dt><dd>{access.audience.join("、")}</dd></div>
          <div><dt>{TIER_COPY.protection}</dt><dd>{tier.protection}</dd></div>
        </dl>
      </section>
    </section>
  );
}
