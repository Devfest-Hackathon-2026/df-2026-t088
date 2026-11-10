import { useState } from "react";
import "./ReduceWalkthrough.css";

const scenes = [
  "ピザ1枚を4つに分けたうち、色がついた2切れが 2/4 です。ピザを帯の図で表してみよう。",
  "2切れずつを1つのまとまりにしてみよう。少ない数で表せます。切れ目をまとめても、色のついた量は変わりません。",
  "全部で2つのまとまりになり、色つきは1つ分。だから 2/4 ＝ 1/2 です。このように、同じ大きさのまま分子と分母を小さくすることを約分といいます。",
  "式でも確かめよう。分子の2と分母の4は、どちらも2で割り切れます。2切れずつまとめたので、分子も分母も2で割ります。",
  "分子と分母を同じ数で割ると、同じ大きさの分数になります。まだ両方を同じ数で割れるなら、これ以上割れなくなるまで約分しよう。",
];

/** 本題の答えを出さず、別の例で約分の意味と式の操作をつなぐ。 */
export function ReduceWalkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  return <div className="reduce-guide">
    <button type="button" className="fraction-walk__toggle" onClick={() => { setOpen(!open); setStep(0); }}>{open ? "約分の説明をとじる" : "約分の説明を見る"}</button>
    {open && <section className="reduce-guide__panel" aria-label="約分の説明">
      <h3>別の例で考えよう：2/4</h3>
      <p aria-live="polite">{scenes[step]}</p>
      <p>帯の全体：ピザ1枚分</p>
      <div className={`reduce-guide__pizza ${step >= 1 ? "is-grouped" : ""}`} role="img" aria-label={step === 0 ? "ピザを4等分し、2切れに色がついた図" : "ピザの2切れずつをまとめ、全体が2つ、色つきが1つになった図"}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < 2 ? "is-filled" : ""}>{step === 0 ? i + 1 : ""}</span>)}
      </div>
      {step >= 1 && <div className="reduce-guide__groups"><span>1つめ</span><span>2つめ</span></div>}
      {step >= 2 && <p className="reduce-guide__formula">2/4 ＝ 1/2</p>}
      {step >= 3 && <p>分子：2 ÷ 2 ＝ 1　／　分母：4 ÷ 2 ＝ 2</p>}
      <div className="fraction-walk__controls"><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>もどる</button><span>{step + 1} / {scenes.length}</span><button type="button" disabled={step === scenes.length - 1} onClick={() => setStep(step + 1)}>つぎへ</button></div>
    </section>}
  </div>;
}
