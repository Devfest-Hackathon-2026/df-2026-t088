// トークンの色の文字を、色と透明度に分ける。ビルドの CSS の圧縮が rgb(r g b / a) を #rrggbbaa に書き換えるので、どちらも読む
import * as THREE from "three";

export type ColorParts = { r: number; g: number; b: number; alpha: number };

const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+)(%?))?\s*\)$/;
const HEX_RE = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

/** rgb(... / a)・#rgb・#rgba・#rrggbb・#rrggbbaa を r,g,b（0〜255）と alpha（0〜1）にする。読めなければ null */
export function parseColorParts(text: string): ColorParts | null {
  const t = text.trim();
  const m = RGB_RE.exec(t);
  if (m) {
    let alpha = m[4] === undefined ? 1 : Number(m[4]);
    if (m[5] === "%") alpha /= 100;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), alpha };
  }
  const h = HEX_RE.exec(t);
  if (h) {
    let d = h[1];
    if (d.length <= 4) d = [...d].map((c) => c + c).join("");
    const byte = (i: number) => parseInt(d.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), alpha: d.length === 8 ? byte(6) / 255 : 1 };
  }
  return null;
}

/** #hex か rgb(r g b / a) を、色と透明度に分ける */
export function parseColor(text: string): { color: THREE.Color; alpha: number } {
  const p = parseColorParts(text);
  if (!p) return { color: new THREE.Color(text), alpha: 1 };
  const color = new THREE.Color().setRGB(p.r / 255, p.g / 255, p.b / 255, THREE.SRGBColorSpace);
  return { color, alpha: p.alpha };
}
