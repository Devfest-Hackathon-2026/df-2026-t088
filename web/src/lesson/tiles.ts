// タイルの盤の判定。画面にも通信にも触らない純粋な関数だけを置く。どの操作も元の盤を書き換えない
import { calculate, ceilToWhole, countUnits, fractionsEqual, leastCommonMultiple } from "./fraction";
import type { Fraction, Operator } from "./fraction";

export interface Problem {
  left: Fraction;
  operator: Operator;
  right: Fraction;
  answer: Fraction;
  /** 約分の問題。1枚のタイルを、もっと大きいタイルでうめ直す。right は 0 になる */
  isRewrite?: boolean;
  /** 同じ大きさの分数の問題。約分と同じ「1枚をうめ直す」操作で、うめるタイルは答えの分母のタイル。細かいタイルでも大きいタイルでもよい */
  isEquivalent?: boolean;
  /** わり算と分数の問題。1/b のタイルを a まい並べる。answer は約分せずに {a, b} を持ち、answer.num が並べる枚数になる */
  isDivide?: boolean;
}

/** タイル置き場に用意するタイルの種類と枚数 */
export interface PieceSupply extends Fraction {
  count: number;
}

export interface Piece extends PieceSupply {
  key: string;
  colorIndex: number;
}

export interface Tile {
  id: number;
  key: string;
  /** 重ねた単位分数のタイル */
  coverKey: string | null;
  coverCount: number;
  /** ひき算で上に重ねて取ったタイル */
  takenKey: string | null;
}

export interface PlacedTile extends Tile {
  start: number;
  size: number;
}

export interface TileGame {
  problem: Problem;
  pieces: Piece[];
  /** 1 の長さ。分母の最小公倍数で、これを目盛りにすると位置が整数で済む */
  scale: number;
  wholes: number;
  tiles: Tile[];
  nextId: number;
}

export type TileNotice =
  | "none_left" | "ruler_full" | "take_on_left" | "fill_first" | "mixed_unit" | "already_full" | "already_taken"
  | "cover_tile" | "no_fit" | "loose_unit" | "place_first";

export interface TileResult {
  game: TileGame;
  notice?: TileNotice;
}

export function createProblem(left: Fraction, operator: Operator, right: Fraction): Problem {
  return { left, operator, right, answer: calculate(left, operator, right) };
}

export function createRewriteProblem(value: Fraction): Problem {
  const zero = { num: 0, den: 1 };
  return { left: value, operator: "+", right: zero, answer: calculate(value, "+", zero), isRewrite: true };
}

/** 同じ大きさの分数 value = □/target。答えは約分せずに {value の分子 × target ÷ value の分母, target} を持つ */
export function createEquivalentProblem(value: Fraction, target: number): Problem {
  const num = countUnits(value, target);
  if (num === null) throw new RangeError(`${value.num}/${value.den} は分母 ${target} の分数にできません`);
  return { left: value, operator: "+", right: { num: 0, den: 1 }, answer: { num, den: target }, isRewrite: true, isEquivalent: true };
}

/** わり算 dividend ÷ divisor。答えは約分せずに {dividend, divisor}（6÷3 は 6/3 のまま）。式の右は 0 */
export function createDivideProblem(dividend: number, divisor: number): Problem {
  const answer = { num: dividend, den: divisor };
  return { left: answer, operator: "+", right: { num: 0, den: 1 }, answer, isDivide: true };
}

/* ---------- タイルの用意 ---------- */

function isCommonUnit(piece: Fraction, problem: Problem): boolean {
  if (problem.isRewrite) return piece.num === 1 && piece.den === problem.answer.den;
  return piece.num === 1 && countUnits(problem.left, piece.den) !== null && countUnits(problem.right, piece.den) !== null;
}

// タイルをうめる単位分数。式の分数が単位分数を兼ねることがあるので（2/4 + 1/2 の 1/2）、いちばん細かいものを選ぶ
export function commonUnit({ pieces, problem }: Pick<TileGame, "pieces" | "problem">): Piece {
  return pieces.filter((piece) => isCommonUnit(piece, problem)).reduce((finest, piece) => (piece.den > finest.den ? piece : finest));
}

// 答えが1を超えたら、ものさしを2まで（さらに超えればその分だけ）のばす。ひき算は引かれる数が入る長さが要る
export function rulerWholes(problem: Problem): number {
  return Math.max(1, ceilToWhole(problem.operator === "+" ? problem.answer : problem.left));
}

export function createGame(supplies: PieceSupply[], problem: Problem): TileGame {
  const pieces = supplies.map((supply, colorIndex) => ({ ...supply, key: `${supply.num}/${supply.den}`, colorIndex }));
  const scale = leastCommonMultiple(pieces.map((piece) => piece.den));
  return { problem, pieces, scale, wholes: rulerWholes(problem), tiles: [], nextId: 1 };
}

export function findPiece(game: TileGame, key: string): Piece {
  const piece = game.pieces.find((candidate) => candidate.key === key);
  if (!piece) throw new RangeError(`タイルの種類がありません: ${key}`);
  return piece;
}

function findTile(game: TileGame, tileId: number): Tile {
  const tile = game.tiles.find((candidate) => candidate.id === tileId);
  if (!tile) throw new RangeError(`ものさしにタイルがありません: ${tileId}`);
  return tile;
}

function replaceTile(game: TileGame, nextTile: Tile): TileGame {
  return { ...game, tiles: game.tiles.map((tile) => (tile.id === nextTile.id ? nextTile : tile)) };
}

export function pieceSize(game: TileGame, piece: Piece): number {
  return piece.num * (game.scale / piece.den);
}

export function remainingCount(game: TileGame, key: string): number {
  const used = game.tiles.reduce((total, tile) => total
    + Number(tile.key === key) + Number(tile.takenKey === key)
    + (tile.coverKey === key ? tile.coverCount : 0), 0);
  return findPiece(game, key).count - used;
}

export function rulerLength(game: TileGame): number {
  return game.wholes * game.scale;
}

/** ものさしの上の位置。整数の目盛りで返し、百分率への変換は CSS に任せる */
export function layoutTiles(game: TileGame): PlacedTile[] {
  let start = 0;
  return game.tiles.map((tile) => {
    const size = pieceSize(game, findPiece(game, tile.key));
    const placed = { ...tile, start, size };
    start += size;
    return placed;
  });
}

/* ---------- タイルの操作 ---------- */

function usedLength(game: TileGame): number {
  return game.tiles.reduce((total, tile) => total + pieceSize(game, findPiece(game, tile.key)), 0);
}

export function placeTile(game: TileGame, key: string, index = game.tiles.length): TileResult {
  const piece = findPiece(game, key);
  if (remainingCount(game, key) < 1) return { game, notice: "none_left" };
  const { problem } = game;
  if (problem.isRewrite && !fractionsEqual(piece, problem.left)) return { game, notice: "cover_tile" };
  if (problem.operator === "-" && fractionsEqual(piece, problem.right) && !fractionsEqual(piece, problem.left)) {
    return { game, notice: "take_on_left" };
  }
  if (usedLength(game) + pieceSize(game, piece) > rulerLength(game)) return { game, notice: "ruler_full" };
  const tile: Tile = { id: game.nextId, key, coverKey: null, coverCount: 0, takenKey: null };
  const tiles = [...game.tiles.slice(0, index), tile, ...game.tiles.slice(index)];
  return { game: { ...game, tiles, nextId: game.nextId + 1 } };
}

function isTileFilled(game: TileGame, tile: Tile): boolean {
  const piece = findPiece(game, tile.key);
  if (tile.coverKey === null) return piece.num === 1;
  return tile.coverCount === countUnits(piece, findPiece(game, tile.coverKey).den);
}

function tileUnitDen(game: TileGame, tile: Tile): number {
  return findPiece(game, tile.coverKey ?? tile.key).den;
}

function coverableUnits(game: TileGame, tile: Tile, piece: Piece): number | null {
  if (piece.num !== 1) return null;
  const base = findPiece(game, tile.key);
  const units = countUnits(base, piece.den);
  // 1枚をうめ直す問題は、同じ大きさの大きいタイル1枚（2/6 を 1/3 で）でもうめられる。自分と同じ分母のタイルは重ねない
  const isOneToOne = units === 1 && game.problem.isRewrite === true && piece.den !== base.den;
  return units !== null && (units > 1 || isOneToOne) ? units : null;
}

function coverTile(game: TileGame, tile: Tile, piece: Piece, units: number): TileResult {
  if (tile.coverKey && tile.coverKey !== piece.key) return { game, notice: "mixed_unit" };
  if (tile.coverCount >= units) return { game, notice: "already_full" };
  if (remainingCount(game, piece.key) < 1) return { game, notice: "none_left" };
  return { game: replaceTile(game, { ...tile, coverKey: piece.key, coverCount: tile.coverCount + 1 }) };
}

function takeAway(game: TileGame, tile: Tile, piece: Piece): TileResult {
  if (tile.takenKey) return { game, notice: "already_taken" };
  if (!isTileFilled(game, tile)) return { game, notice: "fill_first" };
  if (countUnits(piece, tileUnitDen(game, tile)) === null) return { game, notice: "mixed_unit" };
  if (remainingCount(game, piece.key) < 1) return { game, notice: "none_left" };
  return { game: replaceTile(game, { ...tile, takenKey: piece.key }) };
}

// 5/6 - 1/6 では 1/6 が「うめるタイル」と「とるタイル」を兼ねる。うめ終わるまでは重ね、うまったら取る
function isTakeAwayDrop(game: TileGame, tile: Tile, piece: Piece): boolean {
  const { problem } = game;
  if (problem.operator !== "-" || !fractionsEqual(piece, problem.right)) return false;
  if (!fractionsEqual(findPiece(game, tile.key), problem.left)) return false;
  const units = coverableUnits(game, tile, piece);
  return units === null || tile.coverCount >= units;
}

/** タイルの上に落としたとき。重ねられないものは、ものさしの続きに置く */
export function dropOnTile(game: TileGame, tileId: number, key: string): TileResult {
  const tile = findTile(game, tileId);
  const piece = findPiece(game, key);
  if (isTakeAwayDrop(game, tile, piece)) return takeAway(game, tile, piece);
  const units = coverableUnits(game, tile, piece);
  if (units !== null) return coverTile(game, tile, piece, units);
  return game.problem.isRewrite ? { game, notice: "no_fit" } : placeTile(game, key);
}

/* ---------- 押す操作だけで置く ---------- */

function operands({ left, right, operator, isRewrite, isDivide }: Problem): Fraction[] {
  if (isDivide) return Array.from({ length: left.num }, () => ({ num: 1, den: left.den }));
  return isRewrite || operator === "-" ? [left] : [left, right];
}

// 式のタイルで、まだ置いていない分があるか。同じ分数が2つある式（1/4 + 1/4）は2枚とも置く
function needsPlacing(game: TileGame, value: Fraction): boolean {
  const needed = operands(game.problem).filter((operand) => fractionsEqual(operand, value)).length;
  const placed = game.tiles.filter((tile) => fractionsEqual(findPiece(game, tile.key), value)).length;
  return placed < needed;
}

function acceptsPiece(game: TileGame, tile: Tile, piece: Piece): boolean {
  if (isTakeAwayDrop(game, tile, piece)) return tile.takenKey === null;
  const units = coverableUnits(game, tile, piece);
  return units !== null && tile.coverCount < units && (tile.coverKey === null || tile.coverKey === piece.key);
}

function stackTarget(game: TileGame, piece: Piece): Tile | undefined {
  return needsPlacing(game, piece) ? undefined : game.tiles.find((tile) => acceptsPiece(game, tile, piece));
}

/** 押すと、ものさしの端ではなくタイルの上に重なるか。ボタンの名前を決める */
export const stacksOnPress = (game: TileGame, key: string): boolean => stackTarget(game, findPiece(game, key)) !== undefined;

function refusedNotice(game: TileGame): TileNotice {
  if (operands(game.problem).some((operand) => needsPlacing(game, operand))) return "place_first";
  return game.problem.isRewrite ? "no_fit" : "already_full";
}

/**
 * 「ものさしに置く」を押した時。式のタイルは続きに置き、うめるタイルは空きのあるタイルへ重ねる。
 * 端に並べるとうまらないまま長さだけが増え、「ものさしより長くなります」で止まるので、重ねられない時は置かずに文で返す
 */
export function pressOnRuler(game: TileGame, key: string): TileResult {
  const piece = findPiece(game, key);
  if (remainingCount(game, key) < 1) return { game, notice: "none_left" };
  if (needsPlacing(game, piece)) return placeTile(game, key);
  const target = stackTarget(game, piece);
  return target ? dropOnTile(game, target.id, key) : { game, notice: refusedNotice(game) };
}

export function removeTile(game: TileGame, tileId: number): TileGame {
  return { ...game, tiles: game.tiles.filter((tile) => tile.id !== tileId) };
}

export function moveTile(game: TileGame, tileId: number, index: number): TileGame {
  const moving = findTile(game, tileId);
  const others = game.tiles.filter((tile) => tile.id !== tileId);
  return { ...game, tiles: [...others.slice(0, index), moving, ...others.slice(index)] };
}

/** 1段だけ戻す。取ったタイルがあれば先に戻し、なければ重ねたタイルを1枚外す。戻すものが無ければ元の盤を返す */
export function undoOnTile(game: TileGame, tileId: number): TileGame {
  const tile = findTile(game, tileId);
  if (tile.takenKey) return replaceTile(game, { ...tile, takenKey: null });
  if (tile.coverCount === 0) return game;
  const coverCount = tile.coverCount - 1;
  return replaceTile(game, { ...tile, coverCount, coverKey: coverCount === 0 ? null : tile.coverKey });
}

export function clearBoard(game: TileGame): TileGame {
  return { ...game, tiles: [] };
}

/* ---------- 組み合わせの判定 ---------- */

function isAdditionSolved(game: TileGame): boolean {
  const { left, right } = game.problem;
  const [first, second] = game.tiles;
  if (game.tiles.length !== 2 || !first || !second) return false;
  const [firstPiece, secondPiece] = [findPiece(game, first.key), findPiece(game, second.key)];
  const isPair = (fractionsEqual(firstPiece, left) && fractionsEqual(secondPiece, right))
    || (fractionsEqual(firstPiece, right) && fractionsEqual(secondPiece, left));
  return isPair && isTileFilled(game, first) && isTileFilled(game, second)
    && tileUnitDen(game, first) === tileUnitDen(game, second);
}

function isSubtractionSolved(game: TileGame): boolean {
  const [tile] = game.tiles;
  if (game.tiles.length !== 1 || !tile) return false;
  return fractionsEqual(findPiece(game, tile.key), game.problem.left) && isTileFilled(game, tile) && tile.takenKey !== null;
}

// 1/b のタイルを、ちょうど a まい並べる。重ねたり取ったりはしない
function isDivideSolved(game: TileGame): boolean {
  const { answer } = game.problem;
  return game.tiles.length === answer.num && game.tiles.every((tile) => {
    const piece = findPiece(game, tile.key);
    return piece.num === 1 && piece.den === answer.den && tile.coverKey === null && tile.takenKey === null;
  });
}

function isRewriteSolved(game: TileGame): boolean {
  const [tile] = game.tiles;
  if (game.tiles.length !== 1 || !tile || tile.coverKey === null) return false;
  return isTileFilled(game, tile) && tileUnitDen(game, tile) === game.problem.answer.den;
}

export function isSolved(game: TileGame): boolean {
  if (game.problem.isDivide) return isDivideSolved(game);
  if (game.problem.isRewrite) return isRewriteSolved(game);
  return game.problem.operator === "+" ? isAdditionSolved(game) : isSubtractionSolved(game);
}

function alignFraction(value: Fraction, den: number): Fraction {
  return { num: countUnits(value, den) ?? 0, den };
}

/** 式にもどすときに見せる、分母をそろえた形。例 1/2 + 1/3 → 3/6 + 2/6。解けた盤にだけ使う */
export function alignedExpression(game: TileGame): { left: Fraction; right: Fraction } {
  const [first] = game.tiles;
  const den = first ? tileUnitDen(game, first) : 1;
  return { left: alignFraction(game.problem.left, den), right: alignFraction(game.problem.right, den) };
}

export function takenUnits(game: TileGame, tile: Tile): number {
  return tile.takenKey ? countUnits(findPiece(game, tile.takenKey), tileUnitDen(game, tile)) ?? 0 : 0;
}

function countingDen(game: TileGame): number | null {
  const covered = game.tiles.find((tile) => tile.coverKey);
  if (covered) return tileUnitDen(game, covered);
  const [first] = game.tiles;
  return first && isSolved(game) ? tileUnitDen(game, first) : null;
}

// ものさしの上で単位分数が何枚分か。重ねた単位分数がまだ無ければ null。
// 1/4 + 1/4 は重ねずに解けるので、解けていれば置いたタイルの分母で数える
export function rulerCount(game: TileGame): { den: number; count: number } | null {
  const den = countingDen(game);
  if (den === null) return null;
  const count = game.tiles.reduce((total, tile) => {
    if (tile.coverKey && tileUnitDen(game, tile) === den) return total + tile.coverCount - takenUnits(game, tile);
    const piece = findPiece(game, tile.key);
    return total + (piece.num === 1 && piece.den === den ? 1 - takenUnits(game, tile) : 0);
  }, 0);
  return { den, count };
}

/* ---------- ヒントと動き ---------- */

/** ヒントは順に1つずつ増え、最後で止まる */
export function revealNextHint(hints: string[], shownCount: number): number {
  return Math.min(shownCount + 1, hints.length);
}

/** 動きを減らす設定の人には、すべらせずに一度で動かす */
export function scrollBehaviorFor(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}
