import { useState, type RefObject } from "react";

export function FractionAnswer({ label, value, onChange, inputRef, allowMixed = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; inputRef?: RefObject<HTMLInputElement | null>; allowMixed?: boolean; disabled?: boolean }) {
  const parts = /^(?:(\d+)と)?(\d*)\/(\d*)$/.exec(value.normalize("NFKC"));
  const [mode, setMode] = useState<"fraction" | "integer" | "mixed">(parts?.[1] ? "mixed" : value && !value.includes("/") ? "integer" : "fraction");
  const [whole, setWhole] = useState(parts?.[1] ?? (value && !value.includes("/") ? value : ""));
  const [numerator, setNumerator] = useState(parts?.[2] ?? "");
  const [denominator, setDenominator] = useState(parts?.[3] ?? "");
  const update = (nextMode: typeof mode, w: string, n: string, d: string) => {
    if (nextMode === "integer") onChange(w);
    else if (!w && !n && !d) onChange("");
    else onChange(`${nextMode === "mixed" && w ? `${w}と` : ""}${n}/${d}`);
  };
  return <div className="fraction-answer" role="group" aria-label={label}>
    {allowMixed && <div className="fraction-answer__modes"><button type="button" disabled={disabled} aria-pressed={mode === "fraction"} onClick={() => { setMode("fraction"); update("fraction", "", numerator, denominator); }}>分数</button><button type="button" disabled={disabled} aria-pressed={mode === "mixed"} onClick={() => { setMode("mixed"); update("mixed", whole, numerator, denominator); }}>帯分数</button><button type="button" disabled={disabled} aria-pressed={mode === "integer"} onClick={() => { setMode("integer"); update("integer", whole, "", ""); }}>整数</button></div>}
    <div className="fraction-answer__entry">{mode !== "fraction" && <label>整数<input aria-label={`${label}の整数部分`} inputMode="numeric" maxLength={20} disabled={disabled} value={whole} onChange={(e) => { setWhole(e.target.value); update(mode, e.target.value, numerator, denominator); }} /></label>}
      {mode !== "integer" && <div className="fraction-answer__stack"><label><span>分子</span><input ref={inputRef} aria-label={`${label}の分子`} inputMode="numeric" maxLength={20} disabled={disabled} value={numerator} onChange={(e) => { setNumerator(e.target.value); update(mode, whole, e.target.value, denominator); }} /></label><label><span>分母</span><input aria-label={`${label}の分母`} inputMode="numeric" maxLength={20} disabled={disabled} value={denominator} onChange={(e) => { setDenominator(e.target.value); update(mode, whole, numerator, e.target.value); }} /></label></div>}
    </div><span className="lesson-hidden">{value}</span>
  </div>;
}
