import { useEffect, useState } from "react";
import { ApiError, call, type ReadResult } from "../research/api";
import { useLoopAccess } from "./loop-access";
import { PATTERN_LABEL } from "./copy";
import "./LearningLoopDiagram.css";

type EffectSide = { count: number; correct: number | null };
type AssistantItem = {
  lessonKey: string; problem: string; pattern: string; count: number; status: string; source: "dummy" | "demo";
  effect: { status: "undetermined" | "compared"; before: EffectSide; after: EffectSide };
};
type LoopState = { assistant: AssistantItem[]; stumbles: { lessonKey: string; problem: string; count: number; patterns: { pattern: string; count: number }[] }[] };

// 型の名前は、右のカード（LoopAssistantCard）と同じ文を使う。図だけ別の言い方にすると、同じ型だと分からない（#535）
const labelOf = (pattern: string): string => pattern === "unclassified" ? "考え方を分類できない" : (PATTERN_LABEL as Record<string, string>)[pattern] ?? "考え方を分類できない";
// 割合は 5 件以上そろったときだけ出す（少なすぎる件数で効いたと見せない）
const MIN_COUNT = 5;
const TOP_PATTERNS = 2;

function weightedRate(sides: EffectSide[]): number | null {
  const counted = sides.filter((side) => side.correct !== null);
  const total = counted.reduce((sum, side) => sum + side.count, 0);
  if (total < MIN_COUNT) return null;
  return Math.round(counted.reduce((sum, side) => sum + side.count * (side.correct ?? 0), 0) / total * 100);
}

// 一覧の先頭の選ぶ欄へフォーカスを移す（上下に積むときはそこまで動かす）。無ければ見出しへ動かす
function goToAssistant() {
  const select = document.querySelector<HTMLSelectElement>(".loop-assistant__items select");
  if (select) {
    select.scrollIntoView({ behavior: "smooth", block: "nearest" });
    select.focus({ preventScroll: true });
    return;
  }
  document.getElementById("loop-assistant-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function RateBar({ label, rate }: { label: string; rate: number }) {
  return (
    <div className="learning-loop__rate">
      <span>{label}</span>
      <span className="learning-loop__bar" aria-hidden="true"><span style={{ width: `${rate}%` }} /></span>
      <strong>{rate}%</strong>
    </div>
  );
}

// 学びの輪（#301）。4 つの段を輪に並べ、真ん中に「いますること」を 1 つだけ出す。
// 1 つまずきが集まる → 2 間違え方の型 → 3 先生が直し方を選ぶ → 4 次の子で効いたか → 1 に戻る
export function LearningLoopDiagram({ reloadKey = 0 }: { reloadKey?: number } = {}) {
  const { approverKey, headers, unauthorizedText } = useLoopAccess();
  const [data, setData] = useState<LoopState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      call<{ items: AssistantItem[] }>("GET", "/api/v1/loop/assistant", undefined, headers),
      call<ReadResult>("POST", "/api/v1/stumbles/query", { role: "teacher", scope: "summary", purpose: "学びの輪の図を見る", period: "7days" }),
    ]).then(([assistant, summary]) => {
      if (!active) return;
      setError(null);
      setData({ assistant: assistant.items, stumbles: summary.scope === "summary" ? summary.items : [] });
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof ApiError && cause.code === "UNAUTHORIZED"
        ? unauthorizedText("画面の上の「承認キー」を入れてください")
        : "学びの輪を読み込めませんでした");
    });
    return () => { active = false; };
  }, [approverKey, reloadKey]);

  if (error) return <section className="learning-loop" aria-labelledby="learning-loop-title"><h2 id="learning-loop-title">学びの輪</h2><p role="status">{error}</p></section>;
  if (!data) return <section className="learning-loop" aria-labelledby="learning-loop-title"><h2 id="learning-loop-title">学びの輪</h2><p role="status">読み込んでいます</p></section>;

  const items = data.assistant;
  const stumbleCount = data.stumbles.reduce((total, entry) => total + entry.count, 0);
  const patterns = new Map<string, number>();
  for (const entry of items) patterns.set(entry.pattern, (patterns.get(entry.pattern) ?? 0) + entry.count);
  const ranked = [...patterns].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const pending = items.filter((entry) => entry.status === "pending");
  const approved = items.filter((entry) => entry.status === "approved");
  const beforeRate = weightedRate(approved.map((entry) => entry.effect.before));
  const afterRate = weightedRate(approved.map((entry) => entry.effect.after));
  const sample = items.some((entry) => entry.source === "dummy");

  const now = stumbleCount === 0 && items.length === 0
    ? { text: "子どもが予想を間違えると、ここに集まります", action: "見本で試す" }
    : pending.length > 0
      ? { text: "直し方を 1 つ選ぶと、次に同じ間違いをした子に届きます", action: "直し方を選ぶ" }
      : approved.length > 0 && (beforeRate === null || afterRate === null)
        ? { text: "選んだ直し方を見た子の答えを待っています", action: null }
        : { text: "効き目を見て、ほかの直し方も試せます", action: "カードを見る" };

  return (
    <section className="learning-loop" aria-labelledby="learning-loop-title">
      <div className="learning-loop__heading">
        <h2 id="learning-loop-title">学びの輪</h2>
        {sample && <span className="learning-loop__badge">見本のデータ</span>}
        <span className="learning-loop__period">この 7 日</span>
      </div>
      <div className="learning-loop__ring">
        <ol className="learning-loop__stages">
          <li className="learning-loop__stage learning-loop__stage--1">
            <span className="learning-loop__stage-title">1 つまずきが集まる</span>
            <strong className="learning-loop__big">{stumbleCount} 件</strong>
          </li>
          <li className="learning-loop__stage learning-loop__stage--2">
            <span className="learning-loop__stage-title">2 間違え方の型</span>
            {ranked.length === 0 ? <span className="learning-loop__note">まだ型はありません</span> : (
              <ul className="learning-loop__patterns">
                {ranked.slice(0, TOP_PATTERNS).map(([pattern, count]) => <li key={pattern}><span>{labelOf(pattern)}</span><strong>{count}</strong></li>)}
                {ranked.length > TOP_PATTERNS && <li className="learning-loop__note">ほか {ranked.length - TOP_PATTERNS} つ</li>}
              </ul>
            )}
          </li>
          <li className={`learning-loop__stage learning-loop__stage--3${pending.length > 0 ? " is-now" : ""}`}>
            <span className="learning-loop__stage-title">3 先生が直し方を選ぶ</span>
            <strong>{pending.length > 0 ? `選ぶのを待つ型 ${pending.length} つ` : `選んだ直し方 ${approved.length} つ`}</strong>
          </li>
          <li className="learning-loop__stage learning-loop__stage--4">
            <span className="learning-loop__stage-title">4 次の子で効いたか</span>
            {beforeRate !== null && afterRate !== null ? (
              <><RateBar label="選ぶ前" rate={beforeRate} /><RateBar label="選んだ後" rate={afterRate} /><span className="learning-loop__note">ヒントの後に正しく答えた割合</span></>
            ) : <span className="learning-loop__note">選ぶ前と後が {MIN_COUNT} 件ずつそろうと比べます</span>}
          </li>
        </ol>
        <div className="learning-loop__arrows" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 62 8 Q 86 8 86 30" />
            <path d="M 86 70 Q 86 92 62 92" />
            <path d="M 38 92 Q 14 92 14 70" />
            <path d="M 14 30 Q 14 8 38 8" />
          </svg>
          <span className="learning-loop__turn learning-loop__turn--1">↘</span>
          <span className="learning-loop__turn learning-loop__turn--2">↙</span>
          <span className="learning-loop__turn learning-loop__turn--3">↖</span>
          <span className="learning-loop__turn learning-loop__turn--4">↗</span>
        </div>
        <div className="learning-loop__now">
          <strong>いますること</strong>
          <p>{now.text}</p>
          {now.action && <button type="button" className="button button--primary learning-loop__now-button" onClick={goToAssistant}>{now.action}</button>}
        </div>
      </div>
    </section>
  );
}
