import { LOOP_OCCURRENCE_COPY } from "./copy";
import "./LoopOccurrenceLine.css";

// 承認の前と後の間違えの件数（#519）。件数を並べるだけで、良し悪しは書かない。
// 5 件に届かない側があるとき（サーバが count を null にする）は、数字を出さず「まだ少ない」と出す。
export type LoopStumbles = { before: { count: number | null }; after: { count: number | null } };

export function LoopOccurrenceLine({ stumbles }: { stumbles: LoopStumbles | undefined }) {
  if (!stumbles) return null;
  const { before, after } = stumbles;
  const text = before.count !== null && after.count !== null
    ? LOOP_OCCURRENCE_COPY.counts(before.count, after.count)
    : LOOP_OCCURRENCE_COPY.fewYet;
  return <p className="loop-occurrence">{text}</p>;
}
