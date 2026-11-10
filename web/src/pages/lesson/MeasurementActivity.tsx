import { useState, type CSSProperties } from "react";
import "./MeasurementActivity.css";

/** 端をそろえる・任意の枚数を並べる操作。答えの判定は行わない。 */
export function MeasurementActivity({ kind, unitCount = 4 }: { kind: "length" | "measure"; unitCount?: number }) {
  const [aligned, setAligned] = useState(false);
  const [blocks, setBlocks] = useState(0);
  if (kind === "length") return <div className="measurement">
    <div className="measurement__tape-row"><span>あか</span><div className="measurement__track"><div className="measurement__tape measurement__tape--red" /></div></div>
    <div className="measurement__tape-row"><span>あお</span><div className="measurement__track"><div className={`measurement__tape measurement__tape--blue ${aligned ? "is-aligned" : ""}`} /></div></div>
    <div className="measurement__controls"><button type="button" onClick={() => setAligned(!aligned)}>{aligned ? "もとに もどす" : "はしを そろえる"}</button></div>
    <p className="measurement__status" role="status">{aligned ? "ひだりの はしが そろったよ。みぎの はしを くらべよう。" : "ひだりの はしが ずれているよ。"}</p>
  </div>;
  return <div className="measurement">
    <div>えんぴつ</div><div className="measurement__pencil" />
    <div>ブロック</div><div className="measurement__blocks" style={{ "--measurement-unit-width": `${100 / unitCount}%` } as CSSProperties} aria-label="ならべた ブロック">{Array.from({ length: blocks }, (_, i) => <span key={i} aria-label="ブロック1こ" />)}</div>
    <div className="measurement__controls"><button type="button" onClick={() => setBlocks(Math.min(blocks + 1, 6))} disabled={blocks === 6}>1こ おく</button><button type="button" onClick={() => setBlocks(0)} disabled={blocks === 0}>はじめから</button></div>
    <p className="measurement__status" role="status">{blocks > 0 ? "ブロックを ならべたよ。" : "はしから ならべてみよう。"}</p>
  </div>;
}
