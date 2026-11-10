import { describe, expect, it } from "vitest";
import { COPY } from "./copy";

// vitest では CSS の ?raw が空になる。@types/node も無いので、fs は文字列をつないで読み込む（vitest は web/ で動かす）
const { readFileSync } = (await import(/* @vite-ignore */ "node:" + "fs")) as { readFileSync: (path: string, encoding: "utf8") => string };
const indexHtml = readFileSync("index.html", "utf8");
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");

// 起動のローディング（CMP-012）は index.html に値を書き写している（R-10）。tokens.css とずれていないか確かめる
// var(--x) の別名は実際の値までたどる
const token = (name: string): string => {
  const m = tokensCss.match(new RegExp(`(?:^|\\s)${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`${name} が tokens.css に無い`);
  const alias = m[1].trim().match(/^var\((--[\w-]+)\)$/);
  return alias ? token(alias[1]) : m[1].trim();
};
const ms = (value: string) => Number.parseFloat(value);
const doc = new DOMParser().parseFromString(indexHtml, "text/html");
const style = doc.querySelector("style")?.textContent ?? "";

describe("起動のローディング", () => {
  it("#loading は #root の外にあり、role=status で CP-007 の文言を出す", () => {
    const loading = doc.getElementById("loading");
    expect(loading).not.toBeNull();
    expect(doc.getElementById("root")?.contains(loading)).toBe(false);
    expect(loading?.getAttribute("role")).toBe("status");
    expect(loading?.querySelector("p")?.textContent).toBe(COPY.CP_007);
    expect(loading?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("開始時刻の印が #loading の直前にある", () => {
    const loading = doc.getElementById("loading");
    expect(loading?.previousElementSibling?.textContent).toContain('performance.mark("loading-start")');
  });

  it("色と大きさが tokens.css と同じ", () => {
    expect(style).toContain(token("--color-bg").toLowerCase());
    expect(style).toContain(token("--color-grid").toLowerCase());
    expect(style).toContain(token("--grid-size"));
    expect(style).toContain(token("--color-fg").toLowerCase());
    expect(indexHtml).toContain(token("--color-now").toLowerCase());
    for (const part of ["--orange-300", "--sand-200", "--ink-500", "--pink-300"]) {
      expect(indexHtml).toContain(token(part).toLowerCase());
    }
    expect(style).toContain(token("--color-pencil-line").toLowerCase());
    expect(style).toContain(`width: ${token("--loading-art-width")}`);
  });

  it("紙の背景で覆い、見出しだけがその手前に出る", () => {
    expect(style).toContain("background: inherit;");
    const z = Number(style.match(/#loading \{[^}]*?z-index: (\d+);/)?.[1]);
    expect(Number(token("--z-over-loading"))).toBeGreaterThan(z);
  });

  it("文字が tokens.css と同じ", () => {
    expect(style).toContain(`font-family: ${token("--font-hand")}`);
    expect(style).toContain(`font-size: ${token("--text-body")}`);
    expect(style).toContain(`font-weight: ${token("--text-body-weight")}`);
    expect(style).toContain(`line-height: ${token("--text-body-line")}`);
  });

  it("reduced-motion でも base.css に消されず、出す遅れの後に見える", () => {
    expect(style).toContain(`#loading { animation: loading-in 1ms linear ${token("--delay-loading")} forwards !important; }`);
  });

  it("周期は --duration-draw と --duration-draw-hold の和", () => {
    const cycle = ms(token("--duration-draw")) + ms(token("--duration-draw-hold"));
    expect(cycle).toBe(5800);
    expect(style).toContain(`${cycle}ms linear`);
    // 描き終わりの割合
    const end = ((ms(token("--duration-draw")) / cycle) * 100).toFixed(4);
    expect(style).toContain(`${end}%`);
  });

  it("描く線ごとにキーフレームがあり、順に描かれて --duration-draw で描き終わる", () => {
    const classes = [...doc.querySelectorAll(".pen path")].map((p) => p.getAttribute("class")?.split(" ")[0] ?? "");
    const order = [...new Set(classes)];
    expect(order.length).toBeGreaterThan(10);
    const ends = order.map((name) => {
      expect(style).toContain(`#loading .${name} { animation: ${name} `);
      const found = style.match(new RegExp(`@keyframes ${name} \\{ 0%, ([\\d.]+)%.*? ([\\d.]+)%, 100%`));
      expect(found, name).not.toBeNull();
      return [Number(found?.[1]), Number(found?.[2])];
    });
    for (let i = 1; i < ends.length; i++) expect(ends[i][0]).toBeGreaterThanOrEqual(ends[i - 1][1]);
    const draw = ms(token("--duration-draw"));
    expect(ends.at(-1)?.[1]).toBeCloseTo((draw / (draw + ms(token("--duration-draw-hold")))) * 100, 3);
  });

  it("鉛筆は線をなぞらず、部位のそばへ移って小さく動く", () => {
    const cycle = ms(token("--duration-draw")) + ms(token("--duration-draw-hold"));
    expect(style).not.toContain("offset-path");
    expect(style).toContain(`pencil-move ${cycle}ms ease-in-out ${token("--delay-loading")} infinite`);
    expect(style).toContain(`pencil-scribble ${token("--duration-scribble")} ease-in-out ${token("--delay-loading")} infinite`);
    const frames = style.slice(style.indexOf("@keyframes pencil-scribble"), style.indexOf("@keyframes loading-in"));
    const moves = [...frames.matchAll(/translate\((-?[\d.]+)(?:px)?, (-?[\d.]+)(?:px)?\)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
    expect(moves.length).toBeGreaterThan(4);
    expect(Math.max(...moves.map(Math.abs))).toBeLessThanOrEqual(6);
    const move = style.slice(style.indexOf("@keyframes pencil-move"));
    expect(new Set(move.slice(0, move.indexOf("\n}")).match(/translate: [^;]+;/g)).size).toBe(8);
  });

  it("鉛筆の粒は紙と方眼を変えず、線の上にだけ効く", () => {
    expect(style).toContain("mix-blend-mode: lighten");
    const [r, g, b] = doc.querySelector("feColorMatrix")?.getAttribute("values")?.trim().split(/\s+/).filter((_, i) => i === 4 || i === 9 || i === 14).map(Number) ?? [];
    const hex = [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
    expect(`#${hex}`).toBe(token("--color-grid").toLowerCase());
  });

  it("reduced-motion では鉛筆を消し、絵を描き上がった形で止める", () => {
    const reduced = style.slice(style.indexOf("@media (prefers-reduced-motion"));
    expect(reduced).toContain("#loading .pen path");
    expect(reduced).toContain("stroke-dashoffset: 0");
    expect(reduced).toContain("#loading .loading-pencil { animation: none; display: none; }");
  });

  it("出す遅れと消える長さが tokens.css と同じ", () => {
    expect(style).toContain(`linear ${token("--delay-loading")} forwards`);
    expect(style).toContain(`loading-out ${token("--duration-normal")} cubic-bezier`);
  });
});
