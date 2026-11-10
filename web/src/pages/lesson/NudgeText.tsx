import { Ruby } from "../../components/Ruby";

/** CMP-021 手が止まった時の声かけ。読み上げに届くように、文が無い間も置いておく */
export function NudgeText({ text }: { text: string | null }) {
  return <p className="lesson-nudge" role="status">{text && <span className="lesson-nudge-text"><Ruby text={text} /></span>}</p>;
}
