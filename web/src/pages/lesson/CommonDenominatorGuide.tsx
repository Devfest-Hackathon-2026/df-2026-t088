import { useState } from "react";
import type { Fraction } from "../../lesson/fraction";

export function CommonDenominatorGuide({ left, right }: { left: Fraction; right: Fraction }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [den, setDen] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const check = () => {
    const value = Number(input.normalize("NFKC").trim());
    if (!Number.isInteger(value) || value < 1 || value > 120) { setDen(null); setMessage("1から120までの整数を入れましょう。"); return; }
    if (value % left.den || value % right.den) { setDen(null); setMessage(`${left.den}と${right.den}の両方で割り切れる数を探しましょう。`); return; }
    setDen(value); setMessage("どちらも同じ数に分けられます。色のついた部分はそれぞれ何こ分かな？");
  };
  return <div className="common-guide">
    <button type="button" className="fraction-walk__toggle" onClick={() => setOpen(!open)}>{open ? "図をとじる" : "分母を考えて図を見る"}</button>
    {open && <section className="common-guide__panel" aria-label="分母を考える">
      <p>{left.den}と{right.den}の両方の倍数になる数は？ 1を何等分にそろえるか考えよう。</p>
      <label htmlFor="common-den">そろえる分母</label><div className="common-guide__controls"><input id="common-den" type="text" inputMode="numeric" value={input} onChange={(event) => { setInput(event.target.value); setDen(null); setMessage(""); }} /><button type="button" onClick={check}>たしかめる</button></div>
      <p role="status">{message}</p>
      {den !== null && <div className="common-guide__figures">{[left, right].map((fraction, row) => <div key={row}>
        <p>{fraction.num}/{fraction.den}（1つの帯が1）</p>
        {Array.from({ length: Math.ceil(fraction.num / fraction.den) }, (_, whole) => <div key={whole} className="common-guide__bar" role="img" aria-label={`${fraction.num}/${fraction.den}を${den}等分した図${whole + 1}本目`}>
          {Array.from({ length: den }, (_, i) => <span key={i} className={whole * den + i < fraction.num * den / fraction.den ? "is-filled" : ""} />)}
        </div>)}</div>)}</div>}
    </section>}
  </div>;
}
