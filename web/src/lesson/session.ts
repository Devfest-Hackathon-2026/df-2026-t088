// 学習の流れ。式を見る → タイルで考える → 式にもどって答える → 次の問題。純粋な関数だけを置く
import { compareFractions, fractionsEqual } from "./fraction";
import { judgeAnswer, judgeCommon, judgeReduced, readWhole } from "./judge";
import { judgeChoice, judgeMulti, judgeNumberText } from "./number-judge";
import type { NumberResult } from "./number-judge";
import type { NumberProblem } from "./number-problem";
import { gameOf, hasTiles, startsWithHints } from "./problems";
import type { LessonDefinition, LessonProblem } from "./problems";
import {
  alignedExpression, clearBoard, commonUnit, dropOnTile, findPiece, isSolved, moveTile, placeTile, pressOnRuler, remainingCount, removeTile,
  revealNextHint, undoOnTile,
} from "./tiles";
import type { TileGame, TileNotice, TileResult } from "./tiles";
import type { Fraction } from "./fraction";

/** answer は式だけ、work はタイルを動かせる、review は式にもどって盤を見くらべる */
export type LessonView = "answer" | "work" | "review";
export type LessonMessage =
  | "empty" | "invalid" | "wrong" | "wrongToTiles" | "wrongToHints" | "wrongInReview" | "correct" | "back" | "backAligned" | "backChoice"
  | "notLowest" | "notCommon" | "alignedEmpty" | "alignedWrong" | "alignedRight"
  // 数の問題（CP-603、604、606、607、608、611）
  | "invalidDecimal" | "invalidInteger" | "multiEmpty" | "multiMissing" | "multiExtra" | "remainderEmpty";
/** くらべる問題と見積もりの選択肢。left と right は、大きい方の分数やしきい値との関係 */
export type LessonChoice = "left" | "right" | "same" | "above" | "below";
export type LessonNotice = TileNotice | "no_more_hints" | "tiles_next";

export interface LessonSession {
  lesson: LessonDefinition;
  problemIndex: number;
  game: TileGame;
  view: LessonView;
  answerText: string;
  /** 全部えらぶ問題で選んだ札（小さい順）。押すたびに出し入れする */
  picked: number[];
  /** 2つに分けて入れる欄。通分の答えと、式にもどった時の □、商とあまりに使う */
  partTexts: [string, string];
  /** □ が合っていた。□ を式の形に変えて、続きの答えを聞く */
  isAlignedChecked: boolean;
  /** 正解にならなかった答え。欄に残して見られるようにする */
  rejectedAnswer: string | null;
  message: LessonMessage | null;
  notice: LessonNotice | null;
  shownHints: number;
  /** 押して選んだタイルの種類。ドラッグしない操作に使う */
  selectedKey: string | null;
  isCorrect: boolean;
  isCleared: boolean;
}

/** ドラッグを離した時に分かること。tileId は動かしたものさしの上のタイル、置き場からなら null */
export interface TileDrop {
  key: string;
  tileId: number | null;
  targetTileId: number | null;
  isOnRuler: boolean;
  index: number;
}

const problemAt = (lesson: LessonDefinition, index: number): LessonProblem => lesson.problems[index] as LessonProblem;

// タイルで解く学習は、タイルの無い問題を除いて、はじめからタイルを開く
const needsTiles = (lesson: LessonDefinition, problem: LessonProblem): boolean => lesson.isTilesFirst && !startsWithHints(problem);

export function createSession(lesson: LessonDefinition, problemIndex = 0): LessonSession {
  const problem = problemAt(lesson, problemIndex);
  return {
    lesson,
    problemIndex,
    game: gameOf(problem),
    view: needsTiles(lesson, problem) ? "work" : "answer",
    answerText: "",
    picked: [],
    partTexts: ["", ""],
    isAlignedChecked: false,
    rejectedAnswer: null,
    message: null,
    notice: null,
    shownHints: 0,
    selectedKey: null,
    isCorrect: false,
    isCleared: false,
  };
}

export const currentProblem = (session: LessonSession): LessonProblem => problemAt(session.lesson, session.problemIndex);

const isLastProblem = (session: LessonSession): boolean => session.problemIndex >= session.lesson.problems.length - 1;

// タイルを開いて1枚でも置いたのに、盤が解けていない。この間に答えると、図と答えが食い違う
const hasUnsolvedBoard = (session: LessonSession): boolean =>
  session.view === "work" && session.game.tiles.length > 0 && !isSolved(session.game);

/** タイルで解く学習は、解いて式にもどるまで答えを受けない。式で考える問題も、盤に置いたら解けるまでは受けない（空なら受ける） */
export const canAnswer = (session: LessonSession): boolean =>
  (!needsTiles(session.lesson, currentProblem(session)) || session.view === "review") && !hasUnsolvedBoard(session);

// わり算と分数は、タイルで解いたら式にもどってそのまま答える。□ の段も枚数の表示も無い
const countsTiles = ({ kind }: LessonProblem): boolean => kind === "calculate" || kind === "reduce" || kind === "equivalent";

/** 式にもどった時に、タイルで数えた分子を □ に入れてもらうか */
export function needsAligned(session: LessonSession): boolean {
  return session.view === "review" && countsTiles(currentProblem(session)) && !session.isAlignedChecked && !session.isCorrect;
}

/** 分母をそろえた形を式に見せるか。□ が合った後と、正解した後 */
export const showsAligned = (session: LessonSession): boolean =>
  session.view === "review" && currentProblem(session).kind === "calculate" && (session.isAlignedChecked || session.isCorrect);

/** 正解した後に、タイルのまい数を見せるか。通分とくらべるは足していないので、合わせた数に意味が無い */
export const showsCount = (session: LessonSession): boolean =>
  session.isCorrect && countsTiles(currentProblem(session)) && isSolved(session.game);

/** 正解した後と式にもどった間は、盤を変えない。式とずれないようにするため */
export const isBoardLocked = (session: LessonSession): boolean => session.view !== "work" || session.isCorrect;

/* ---------- 答え ---------- */

export function typeAnswer(session: LessonSession, answerText: string): LessonSession {
  return session.isCorrect ? session : { ...session, answerText };
}

export function typePart(session: LessonSession, index: 0 | 1, text: string): LessonSession {
  if (session.isCorrect) return session;
  const partTexts: [string, string] = index === 0 ? [text, session.partTexts[1]] : [session.partTexts[0], text];
  return { ...session, partTexts };
}

function correct(session: LessonSession): LessonSession {
  return { ...session, isCorrect: true, isCleared: isLastProblem(session), message: "correct", rejectedAnswer: null, selectedKey: null, notice: null };
}

// まちがえた時は、「分かんない」で開くものへ誘う。タイルを開いた後なら同じことは言わない
function wrongMessage(session: LessonSession): LessonMessage {
  if (session.view === "review") return "wrongInReview";
  if (session.view !== "answer") return "wrong";
  return startsWithHints(currentProblem(session)) ? "wrongToHints" : "wrongToTiles";
}

function alignedProblem(session: LessonSession): LessonMessage | null {
  const { left, right } = alignedExpression(session.game);
  const expected = session.game.problem.isRewrite ? [left.num] : [left.num, right.num];
  const texts = session.partTexts.slice(0, expected.length);
  if (texts.some((text) => !text.trim())) return "alignedEmpty";
  return texts.every((text, index) => readWhole(text) === expected[index]) ? null : "alignedWrong";
}

// □ だけを先に見る。前の答えが欄に残っていても、□ の判定に混ぜない。
// 約分は □ の分数がそのまま答えなので、ここで終わる。計算は合った □ を式に残し、続きの答えを空の欄で聞く
function submitAligned(session: LessonSession): LessonSession {
  const problem = alignedProblem(session);
  if (problem) return { ...session, message: problem };
  if (session.game.problem.isRewrite) return correct(session);
  return { ...session, isAlignedChecked: true, answerText: "", rejectedAnswer: null, message: "alignedRight" };
}

function submitPair(session: LessonSession, left: Fraction, right: Fraction): LessonSession {
  if (session.partTexts.some((text) => !text.trim())) return { ...session, message: "empty" };
  const result = judgeCommon(session.partTexts, left, right);
  if (result === "correct") return correct(session);
  if (result === "not_common") return { ...session, message: "notCommon" };
  return { ...session, message: result === "wrong" ? wrongMessage(session) : "invalid" };
}

// 同じ大きさの分数の答えは □ の分子だけ。分母は式に書いてある
function submitNumerator(session: LessonSession): LessonSession {
  const text = session.answerText;
  if (!text.trim()) return { ...session, message: "empty" };
  const typed = readWhole(text);
  if (typed === null) return { ...session, message: "alignedEmpty", rejectedAnswer: text };
  return typed === session.game.problem.answer.num ? correct(session) : { ...session, message: wrongMessage(session), rejectedAnswer: text };
}

function submitText(session: LessonSession, problem: LessonProblem): LessonSession {
  const text = session.answerText;
  const expected = session.game.problem.answer;
  if (problem.kind === "equivalent") return submitNumerator(session);
  if (!text.trim()) return { ...session, message: "empty" };
  const result = problem.kind === "reduce" ? judgeReduced(text, expected) : judgeAnswer(text, expected);
  if (result === "correct") return correct(session);
  if (result === "not_lowest") return { ...session, message: "notLowest", rejectedAnswer: text };
  return { ...session, message: result === "wrong" ? wrongMessage(session) : "invalid", rejectedAnswer: text };
}

/* ---------- 数の問題 ---------- */

// 結果ごとに、画面で言うことが決まる。間違いは「分かんない」へ誘う（CP-444）
function numberMessage(session: LessonSession, result: Exclude<NumberResult, "correct">): LessonMessage {
  return result === "wrong" ? wrongMessage(session) : result;
}

function submitNumber(session: LessonSession, problem: NumberProblem): LessonSession {
  const { answer } = problem;
  // 1つ選ぶ問題は、選択肢を押して答える（submitNumberChoice）
  if (answer.type === "choice") return session;
  if (answer.type === "multi") {
    const result = judgeMulti(session.picked, answer.correct);
    return result === "correct" ? correct(session) : { ...session, message: numberMessage(session, result) };
  }
  const isPair = answer.type === "remainder";
  // 商とあまりは、空かどうかを判定の中で見る（どちらが空でも同じ文）
  if (!isPair && !session.answerText.trim()) return { ...session, message: "empty" };
  const result = judgeNumberText(isPair ? session.partTexts : [session.answerText, ""], answer);
  if (result === "correct") return correct(session);
  return { ...session, message: numberMessage(session, result), rejectedAnswer: isPair ? null : session.answerText };
}

/** 全部えらぶ問題の札を押す。選んでいる札はもう一度押すと外れる。正解の後は押せない */
export function togglePick(session: LessonSession, card: number): LessonSession {
  if (session.isCorrect) return session;
  const picked = session.picked.includes(card) ? session.picked.filter((value) => value !== card) : [...session.picked, card].sort((a, b) => a - b);
  return { ...session, picked };
}

/** 数の問題の、1つ選ぶ選択肢を押す。id は問題の答え（NumberAnswer の choice）の options にある */
export function submitNumberChoice(session: LessonSession, id: string): LessonSession {
  if (session.isCorrect || !canAnswer(session)) return session;
  const problem = currentProblem(session);
  if (problem.kind !== "number" || problem.answer.type !== "choice") return session;
  return judgeChoice(id, problem.answer.correct) === "correct" ? correct(session) : { ...session, message: wrongMessage(session) };
}

export function submitAnswer(session: LessonSession): LessonSession {
  if (session.isCorrect || !canAnswer(session)) return session;
  const problem = currentProblem(session);
  if (problem.kind === "number") return submitNumber(session, problem);
  if (needsAligned(session)) return submitAligned(session);
  if (problem.kind === "common") return submitPair(session, problem.left, problem.right);
  return submitText(session, problem);
}

/** 正しい選択肢。式の値はここで計算し、データに答えを書かない */
export function correctChoice(session: LessonSession): LessonChoice | null {
  const problem = currentProblem(session);
  if (problem.kind === "compare") {
    const order = compareFractions(problem.left, problem.right);
    if (order === 0) return "same";
    return order > 0 ? "left" : "right";
  }
  if (problem.kind !== "estimate") return null;
  return compareFractions(session.game.problem.answer, problem.threshold) > 0 ? "above" : "below";
}

export function submitChoice(session: LessonSession, choice: LessonChoice): LessonSession {
  if (session.isCorrect || !canAnswer(session)) return session;
  return choice === correctChoice(session) ? correct(session) : { ...session, message: wrongMessage(session) };
}

export function nextProblem(session: LessonSession): LessonSession {
  return session.isCorrect && !isLastProblem(session) ? createSession(session.lesson, session.problemIndex + 1) : session;
}

/* ---------- 画面の切り替え ---------- */

export function openTiles(session: LessonSession): LessonSession {
  return session.view === "answer" && hasTiles(currentProblem(session)) ? { ...session, view: "work", message: null, notice: null } : session;
}

function backMessage(session: LessonSession): LessonMessage {
  if (needsAligned(session)) return "backAligned";
  return currentProblem(session).kind === "compare" ? "backChoice" : "back";
}

// 式にもどった間は、ものさしと枚数だけを残して式と見くらべられるようにする
export function toReview(session: LessonSession): LessonSession {
  if (session.view !== "work" || !isSolved(session.game)) return session;
  const review: LessonSession = { ...session, view: "review", notice: null, selectedKey: null };
  return { ...review, message: backMessage(review) };
}

/** 盤面はそのまま残っているので、解けた形から続けられる */
export function toTiles(session: LessonSession): LessonSession {
  return session.view === "review" && !session.isCorrect ? { ...session, view: "work", message: null } : session;
}

/* ---------- タイルの操作 ---------- */

// 選んだタイルを使い切ったら選ぶのをやめる。残すと、次に押したタイルが1段戻らず「もうありません」になる。
// 解けた時と、いっぱいのタイルに重ねようとした時も同じで、続けて押せば1段戻せるようにする
function withResult(session: LessonSession, result: TileResult): LessonSession {
  const { selectedKey } = session;
  const isUsedUp = selectedKey !== null && remainingCount(result.game, selectedKey) < 1;
  const isDone = isUsedUp || isSolved(result.game) || result.notice === "already_full";
  return { ...session, game: result.game, notice: result.notice ?? null, selectedKey: isDone ? null : selectedKey };
}

// ものさしの上のタイルを別のタイルへ重ねるときは、いったん外してから重ねる。重ねられなければ元のままにする
function dropOnTarget(game: TileGame, drop: TileDrop, targetTileId: number): TileResult {
  if (drop.tileId === null) return dropOnTile(game, targetTileId, drop.key);
  // 重ねた内容を持つタイルは、外すと内容が消えるので動かさない
  if ((game.tiles.find((tile) => tile.id === drop.tileId)?.coverCount ?? 0) > 0) return { game };
  const base = removeTile(game, drop.tileId);
  const result = dropOnTile(base, targetTileId, drop.key);
  // 重ねられずに、ものさしの続きへ置く道に落ちたときも元のまま。外したタイルの内容を消さない
  if (result.notice || result.game.tiles.length > base.tiles.length) return { game, notice: result.notice };
  return result;
}

// うめるだけのタイルを、ものさしにじかに置いても解けない。置くのは止めず、どこへ置くのかを文で返す
function withLooseNotice(result: TileResult, key: string): TileResult {
  if (result.notice) return result;
  const { game } = result;
  const piece = findPiece(game, key);
  if (game.problem.isDivide) return result;
  const isFiller = piece.key === commonUnit(game).key && !fractionsEqual(piece, game.problem.left) && !fractionsEqual(piece, game.problem.right);
  return isFiller ? { ...result, notice: "loose_unit" } : result;
}

function dropOnRuler(game: TileGame, drop: TileDrop): TileResult {
  if (drop.tileId !== null) return { game: moveTile(game, drop.tileId, drop.index) };
  return withLooseNotice(placeTile(game, drop.key, drop.index), drop.key);
}

export function applyDrop(session: LessonSession, drop: TileDrop): LessonSession {
  if (isBoardLocked(session)) return session;
  const { game } = session;
  if (drop.targetTileId !== null) return withResult(session, dropOnTarget(game, drop, drop.targetTileId));
  if (drop.isOnRuler) return withResult(session, dropOnRuler(game, drop));
  return drop.tileId === null ? session : withResult(session, { game: removeTile(game, drop.tileId) });
}

/** 置き場のタイルを押す。もう一度押すと選ぶのをやめる */
export function selectPiece(session: LessonSession, key: string): LessonSession {
  if (isBoardLocked(session)) return session;
  if (remainingCount(session.game, key) < 1) return { ...session, selectedKey: null, notice: "none_left" };
  return { ...session, selectedKey: session.selectedKey === key ? null : key, notice: null };
}

// ドラッグできない人も外せるように、戻すものが無くなったらタイルごと外す
function stepBack(game: TileGame, tileId: number): TileGame {
  const undone = undoOnTile(game, tileId);
  return undone === game ? removeTile(game, tileId) : undone;
}

/** ものさしの上のタイルを押す。選んだタイルがあれば重ね、なければ1段ずつ戻して、最後はタイルを外す */
export function pressTile(session: LessonSession, tileId: number): LessonSession {
  if (isBoardLocked(session)) return session;
  if (session.selectedKey === null) return withResult(session, { game: stepBack(session.game, tileId) });
  return withResult(session, dropOnTile(session.game, tileId, session.selectedKey));
}

/** 選んだタイルを、ものさしへ置く。うめるタイルは、空きのあるタイルへ重ねる */
export function pressRuler(session: LessonSession): LessonSession {
  if (isBoardLocked(session) || session.selectedKey === null) return session;
  return withResult(session, pressOnRuler(session.game, session.selectedKey));
}

export function takeOffTile(session: LessonSession, tileId: number): LessonSession {
  return isBoardLocked(session) ? session : withResult(session, { game: removeTile(session.game, tileId) });
}

export function clearTiles(session: LessonSession): LessonSession {
  return isBoardLocked(session) ? session : { ...withResult(session, { game: clearBoard(session.game) }), selectedKey: null };
}

export function showHint(session: LessonSession): LessonSession {
  const { hints } = currentProblem(session);
  if (session.shownHints >= hints.length) return { ...session, notice: "no_more_hints" };
  return { ...session, shownHints: revealNextHint(hints, session.shownHints), notice: null };
}

/** 「分かんない」を押す。すぐタイルを開く問題と、ヒントを開いてからタイルへ進む問題がある */
export function pressHelp(session: LessonSession): LessonSession {
  const problem = currentProblem(session);
  if (!startsWithHints(problem)) return openTiles(session);
  const limit = problem.hintsBeforeTiles ?? problem.hints.length;
  if (session.shownHints >= limit) return hasTiles(problem) ? openTiles(session) : showHint(session);
  const next = showHint(session);
  return hasTiles(problem) && next.shownHints >= limit ? { ...next, notice: "tiles_next" } : next;
}
