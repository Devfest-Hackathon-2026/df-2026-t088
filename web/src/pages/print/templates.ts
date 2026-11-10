// PG-010 の説明の「型」のデータと、手順の進み方（05_screens-print.md「手順の進み方」）。
// 画面の部品（ExplainCard、図）は、ここの関数で状態を進める。表示文は locales/ に置く。
import { COPY } from "../../copy";
import { EXPLANATION_LOCALES } from "./locales";
import type { LeverParams, TemplateId } from "./types";

/** MOT-026 の長さ。tokens.css の --duration-walk と同じ値（CSS 変数は JS から読まない） */
export const STEP_WALK_MS = 620;
/** MOT-027 の止まる長さ。tokens.css の --duration-step-hold と同じ値 */
export const STEP_HOLD_MS = 1200;

export interface TemplateInfo {
  id: TemplateId;
  /** 教科の id（data/constants.ts の SUBJECTS） */
  subject: "rika" | "sansu";
  title: string;
  /** 手順ごとの文。長さが手順の数 */
  steps: readonly string[];
  conclusion: string;
}

export const TEMPLATES: Record<TemplateId, TemplateInfo> = {
  "rika-lever": { id: "rika-lever", subject: "rika", ...EXPLANATION_LOCALES.ja.templates["rika-lever"] },
  "rika-moon": { id: "rika-moon", subject: "rika", ...EXPLANATION_LOCALES.ja.templates["rika-moon"] },
  "sansu-fraction-addsub": { id: "sansu-fraction-addsub", subject: "sansu", ...EXPLANATION_LOCALES.ja.templates["sansu-fraction-addsub"] },
};

// ---- てこ ----

export type LeverTilt = "balanced" | "left" | "right";

export interface LeverState {
  /** 0 = 手順1、1 = 手順2、2 = 終わり */
  step: number;
  /** 右に吊るした重さ。まだ吊るしていない間は undefined */
  rightG?: number;
  rightPos: number;
  /** 合わない操作の一言。手順は進まない */
  note?: "light" | "heavy";
}

/** 右の 1 つのおもりが合う重さ */
export function leverAnswer(params: LeverParams): number {
  return (params.left.g * params.left.pos) / params.right.pos;
}

const LEVER_CHOICE_COUNT = 3;
const LEVER_MIN_G = 10;
const LEVER_MAX_G = 100;
const LEVER_STEP_G = 10;

/** 使える間違い方（同じ重さ・逆比）は残し、足りない分は答えに近い 10g 刻みの重さで埋める。10〜100g、3 つ、小さい順 */
export function leverChoices(params: LeverParams): number[] {
  const answer = leverAnswer(params);
  const isUsable = (g: number) => g >= LEVER_MIN_G && g <= LEVER_MAX_G && g % LEVER_STEP_G === 0 && g !== answer;
  const picked = [...new Set([params.left.g, (params.left.g * params.right.pos) / params.left.pos].filter(isUsable))];

  const fillers: number[] = [];
  for (let g = LEVER_MIN_G; g <= LEVER_MAX_G; g += LEVER_STEP_G) if (isUsable(g) && !picked.includes(g)) fillers.push(g);
  fillers.sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer) || a - b);

  return [...picked, ...fillers.slice(0, LEVER_CHOICE_COUNT - 1 - picked.length), answer].sort((a, b) => a - b);
}

/** 予想した重さの形を規則表と比べる。正解や複数の形に当たる答えは分類しない */
export function classifyLeverWrongAnswer(params: LeverParams, guess: number): "lever-same-weight" | "lever-inverse" | "unclassified" {
  if (guess === leverAnswer(params)) return "unclassified";
  const matches = [
    guess === params.left.g ? "lever-same-weight" : null,
    guess === (params.left.g * params.right.pos) / params.left.pos ? "lever-inverse" : null,
  ].filter((pattern): pattern is "lever-same-weight" | "lever-inverse" => pattern !== null);
  return matches.length === 1 ? matches[0] : "unclassified";
}

export function initialLever(params: LeverParams): LeverState {
  return { step: 0, rightPos: params.right.pos };
}

/** 左右の「重さ × めもり」。右がまだ無い間は undefined */
export function leverProducts(params: LeverParams, state: LeverState): { left: number; right: number | undefined } {
  return {
    left: params.left.g * params.left.pos,
    right: state.rightG === undefined ? undefined : state.rightG * state.rightPos,
  };
}

/** 左が大きければ左へ、小さければ右へ。右が無い間は左 */
export function leverTilt(params: LeverParams, state: LeverState): LeverTilt {
  const { left, right } = leverProducts(params, state);
  if (right === undefined || left > right) return "left";
  return left < right ? "right" : "balanced";
}

/** 手順1：重さを選ぶ。合えば手順2へ、合わなければ傾きだけ変えて一言を出す */
export function leverChoose(params: LeverParams, state: LeverState, g: number): LeverState {
  if (state.step !== 0) return state;
  const answer = leverAnswer(params);
  if (g === answer) return { step: 1, rightG: g, rightPos: state.rightPos };
  return { step: 0, rightG: g, rightPos: state.rightPos, note: g < answer ? "light" : "heavy" };
}

/** 手順2：右のおもりを外へ 1 つずらす。めもり 6 の時は、外が無いので内へ 1 つ（左へ傾く） */
export function leverShift(state: LeverState): LeverState {
  if (state.step !== 1 || state.rightG === undefined) return state;
  const rightPos = state.rightPos >= LEVER_MAX_POS ? state.rightPos - 1 : state.rightPos + 1;
  return { step: 2, rightG: state.rightG, rightPos };
}

export const LEVER_MAX_POS = 6;

/** 「さいせい」の 1 手：今の手順の正しい操作 */
export function leverAuto(params: LeverParams, state: LeverState): LeverState {
  if (state.step === 0) return leverChoose(params, state, leverAnswer(params));
  if (state.step === 1) return leverShift(state);
  return state;
}

/**
 * 読みとりの棒の長さ（0〜1）。目盛りの長さを手順の間で変えないよう、左の積の 2 倍を満タンに固定する。
 * 外へずらした後（めもり 1 → 2 で積が 2 倍）まで収まる
 */
export function leverBarRatio(product: number | undefined, leftProduct: number): number {
  if (product === undefined || leftProduct <= 0) return 0;
  return Math.min(1, product / (leftProduct * 2));
}

// ---- 月 ----

/** 月の位置は 0°（太陽の側）から 45° 刻み。反時計回りに増える */
export const MOON_STEP_DEG = 45;
export const MOON_START_DEG = 90;
/** 手順ごとの目標の位置（満月 → 半月 → 新月） */
export const MOON_TARGETS: readonly (readonly number[])[] = [[180], [90, 270], [0]];

export interface MoonState {
  /** 0〜2 = 手順1〜3、3 = 終わり */
  step: number;
  angle: number;
}

export function initialMoon(): MoonState {
  return { step: 0, angle: MOON_START_DEG };
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 近い 45° に寄せる */
export function snapMoonAngle(deg: number): number {
  return normalizeDeg(Math.round(deg / MOON_STEP_DEG) * MOON_STEP_DEG);
}

/** 月を指定の位置へ置く。目標の位置なら次の手順へ。終わった後も置ける（手順は終わりのまま） */
export function moonSet(state: MoonState, angle: number): MoonState {
  const next = snapMoonAngle(angle);
  const targets = MOON_TARGETS[state.step];
  return { step: targets?.includes(next) ? state.step + 1 : state.step, angle: next };
}

export function moonRotate(state: MoonState, delta: number): MoonState {
  return moonSet(state, state.angle + delta);
}

/** 「さいせい」の 1 手：今の手順の目標のうち、いまから反時計回りに進んで一番近い位置へ */
export function moonAuto(state: MoonState): MoonState {
  const targets = MOON_TARGETS[state.step];
  if (!targets) return state;
  const forward = (t: number) => normalizeDeg(t - state.angle) || 360;
  const best = targets.reduce((a, b) => (forward(b) < forward(a) ? b : a));
  return moonSet(state, best);
}

export type MoonShape = { name: string; where: "sun" | "opposite" | "side" };

/** 地球から見た月の形の名前（CP_844 など）と、図の読み上げの「どの側か」 */
export function moonShape(angle: number): MoonShape {
  const a = normalizeDeg(angle);
  const where = a === 0 ? "sun" : a === 180 ? "opposite" : "side";
  const name =
    a === 0 ? COPY.CP_844
    : a === 180 ? COPY.CP_841
    : a === 90 || a === 270 ? COPY.CP_842
    : a === 45 ? COPY.CP_843
    : a === 315 ? COPY.CP_858
    : COPY.CP_857;
  return { name, where };
}
