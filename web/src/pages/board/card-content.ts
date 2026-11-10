import { COPY } from "../../copy";
import { SIDE_TYPES, SUBJECTS } from "../../data";
import { isSideOpen } from "../../game/logic";
import type { LessonTarget } from "../../game/logic";
import type { Game } from "../../game/use-game";

/** 主ボタンの押した時の動き */
export type CardAction = "start" | "next-chapter";

/** カードの中身。文はふりがな記法つき（05_screens「今のマスのカードの中身」） */
export interface CardContent {
  eyebrow: string;
  title: string;
  /** 本文。上から順に出す */
  body: string[];
  /** ボタンの文。無ければ主ボタンを出さない */
  button?: { text: string; action: CardAction };
}

const startButton = { text: COPY.CP_225, action: "start" } as const;

function mainCard(game: Game, index: number): CardContent | null {
  const item = game.chapter.items[index];
  if (!item) return null;
  const done = game.chapterProgress.done;
  const base = { eyebrow: COPY.CP_223(index + 1), title: item.title };
  if (index < done) return { ...base, body: [item.learn, COPY.CP_226] };
  // 問題が無いマスは「じゅんび中」と伝え、ボタンは出さない（D-117、D-123）
  if (!game.hasLesson({ kind: "main", index })) return { ...base, body: [item.learn, COPY.CP_286] };
  if (index > done) return { ...base, body: [item.learn, COPY.CP_227] };
  return { ...base, body: [item.learn], button: startButton };
}

function testCard(game: Game): CardContent {
  const { done, test } = game.chapterProgress;
  const remaining = game.chapter.items.length - done;
  const base = { eyebrow: COPY.CP_228, title: COPY.CP_238(game.chapter.title) };
  // 問題の無い章は先へ進めないので、残りのマスの数より CP-286 を先に出す
  if (!test && !game.hasLesson({ kind: "test" })) return { ...base, body: [COPY.CP_286] };
  if (!test && remaining > 0) return { ...base, body: [COPY.CP_230(remaining)] };
  if (!test) return { ...base, body: [COPY.CP_239], button: { text: COPY.CP_219, action: "start" } };
  // クリア後。学習の無い章へは送らない。章の道からは開けるので、章の中身は見られる
  const next = game.nextChapter;
  if (!next) return { ...base, body: [COPY.CP_221(SUBJECTS.find((subject) => subject.id === game.subjectId)?.name)] };
  if (!game.hasLessonsInChapter(next.id)) return { ...base, body: [COPY.CP_229, COPY.CP_250] };
  return { ...base, body: [COPY.CP_229], button: { text: COPY.CP_220(next.title), action: "next-chapter" } };
}

function sideCard(game: Game, sideId: string): CardContent | null {
  const side = game.chapter.sides.find((candidate) => candidate.id === sideId);
  const progress = game.chapterProgress;
  // 開いていない寄り道は道に出さない（D-76）。選べないので、ここにも来ない
  if (!side || !isSideOpen(progress, side)) return null;
  const base = { eyebrow: SIDE_TYPES[side.type].name, title: side.title };
  if (progress.sides.includes(side.id)) return { ...base, body: [COPY.CP_232], button: startButton };
  return { ...base, body: [side.learn, COPY.CP_231], button: startButton };
}

/** 選んでいる物のカードの中身。選べない物（開いていない寄り道など）は null */
export function cardContent(game: Game, target: LessonTarget): CardContent | null {
  if (target.kind === "main") return mainCard(game, target.index);
  if (target.kind === "test") return testCard(game);
  return sideCard(game, target.sideId);
}

export function sameTarget(a: LessonTarget, b: LessonTarget): boolean {
  if (a.kind === "main" && b.kind === "main") return a.index === b.index;
  if (a.kind === "side" && b.kind === "side") return a.sideId === b.sideId;
  return a.kind === b.kind;
}
