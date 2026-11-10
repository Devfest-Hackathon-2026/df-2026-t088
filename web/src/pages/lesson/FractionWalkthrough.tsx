import type { Fraction } from "../../lesson/fraction";
import { CommonDenominatorGuide } from "./CommonDenominatorGuide";
import { useEffect, useRef, useState } from "react";
import "./FractionWalkthrough.css";

const steps = [
  { text: "1/2は、1を2つに分けた1つ分。1/3は、1を3つに分けた1つ分です。", split: [2, 3], filled: [1, 1] },
  { text: "1つ分の大きさがちがうので、同じ大きさにそろえてから足します。これを通分といいます。", split: [2, 3], filled: [1, 1] },
  { text: "2の倍数は2、4、6…。3の倍数は3、6…。両方にある一番小さい数の6にそろえます。12や24でもそろえられますが、6の方が数えやすいですね。", split: [2, 3], filled: [1, 1] },
  { text: "1/2のそれぞれを3つに分けると、全体は6つ。色のついた部分は3つ分なので、1/2＝3/6です。", split: [6, 3], filled: [3, 1] },
  { text: "1/3のそれぞれを2つに分けると、全体は6つ。色のついた部分は2つ分なので、1/3＝2/6です。", split: [6, 6], filled: [3, 2] },
  { text: "式でも、下の2を6にするため3倍します。上の1も同じように3倍して、1/2＝3/6です。", split: [6, 6], filled: [3, 2], equation: "1/2 → 上も下も ×3 → 3/6" },
  { text: "下の3を6にするには2倍。上の1も同じように2倍して、1/3＝2/6です。", split: [6, 6], filled: [3, 2], equation: "1/3 → 上も下も ×2 → 2/6" },
  { text: "同じ大きさの3つ分と2つ分を合わせると、5つ分。3/6＋2/6＝5/6です。", split: [6, 6], filled: [3, 2], equation: "3/6 ＋ 2/6 ＝ 5/6" },
  { text: "別の例：1/2と1/6なら、6は2でも6でも割り切れます。1/2＝3/6、1/6はそのままです。", split: [6, 6], filled: [3, 1], equation: "1/2 ＋ 1/6 ＝ 3/6 ＋ 1/6" },
];

/** いつでも開ける例。学習中の答えや記録は変更しない。 */
export function FractionWalkthrough({ left, right }: { left?: Fraction; right?: Fraction } = {}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const step = steps[index];
  useEffect(() => {
    if (!playing) return;
    if (index === steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setIndex(index + 1), 11000);
    return () => window.clearTimeout(timer);
  }, [playing, index]);
  const open = () => { setPlaying(false); setIndex(0); dialog.current?.showModal(); };
  return <>
    <button type="button" className="fraction-walk__toggle" onClick={open}>通分の例を見る</button>
    <dialog ref={dialog} onClose={() => setPlaying(false)} className="fraction-walk" aria-labelledby="fraction-walk-title">
      <div className="fraction-walk__header"><h2 id="fraction-walk-title">通分を見てみよう</h2><button type="button" onClick={() => dialog.current?.close()}>とじる</button></div>
      <p className="fraction-walk__example">例：1/2 ＋ 1/3</p>
      <p className="fraction-walk__text" aria-live="polite">{step.text}</p>
      <div className={`fraction-walk__bars fraction-walk__step-${index}`} key={index} role="img" aria-label={`上は${step.split[0]}等分の${step.filled[0]}つ分、下は${step.split[1]}等分の${step.filled[1]}つ分`}>
        {step.split.map((divisions, row) => <div className="fraction-walk__row" key={row}>
          <span>{row === 0 ? "1/2" : "1/3"}</span>
          <div className="fraction-walk__track">{Array.from({ length: divisions }, (_, i) => <span key={i} className={i < step.filled[row] ? "is-filled" : ""}>{i + 1}</span>)}</div>
        </div>)}
      </div>
      {step.equation && <p className="fraction-walk__equation">{step.equation}</p>}
      <div className="fraction-walk__controls"><button type="button" disabled={index === 0} onClick={() => { setPlaying(false); setIndex(index - 1); }}>もどる</button><button type="button" onClick={() => { if (index === steps.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? "一時停止" : "再生"}</button><span>{index + 1} / {steps.length}</span><button type="button" disabled={index === steps.length - 1} onClick={() => { setPlaying(false); setIndex(index + 1); }}>つぎへ</button></div>
      {left && right && <CommonDenominatorGuide left={left} right={right} />}
    </dialog>
  </>;
}
