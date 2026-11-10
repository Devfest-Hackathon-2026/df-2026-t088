import { describe, expect, it } from "vitest";
import { calculateProblem, commonProblem, compareProblem, divideProblem, equivalentProblem, estimateProblem, plainProblem, reduceProblem } from "./problems";
import type { LessonDefinition } from "./problems";
import {
  applyDrop, canAnswer, clearTiles, correctChoice, createSession as startSession, isBoardLocked, needsAligned, nextProblem, openTiles, pressHelp,
  pressRuler, pressTile, selectPiece, showHint, showsAligned, showsCount, submitAnswer, submitChoice, submitNumberChoice, takeOffTile, toReview, toTiles,
  togglePick, typeAnswer, typePart,
} from "./session";
import type { LessonSession, TileDrop } from "./session";
import type { NumberAnswer, NumberProblem, NumberTopic } from "./number-problem";
import { afterParts } from "./wording";
import { isSolved } from "./tiles";
import { answerGap } from "./answer-gap";
import { isRecordableWrong } from "./stumble-reporter";

const f = (num: number, den: number) => ({ num, den });

const LESSON: LessonDefinition = {
  id: "fixture",
  isTilesFirst: false,
  problems: [calculateProblem(f(1, 2), "+", f(1, 3)), calculateProblem(f(1, 2), "+", f(3, 4)), calculateProblem(f(5, 6), "-", f(1, 3))],
};

const createSession = (lesson = LESSON) => startSession(lesson);

const answered = (session: LessonSession, text: string): LessonSession => submitAnswer(typeAnswer(session, text));

const drop = (values: Partial<TileDrop> & { key: string }): TileDrop => ({ tileId: null, targetTileId: null, isOnRuler: true, index: 0, ...values });

const tileIdAt = (session: LessonSession, index: number): number => session.game.tiles[index]?.id ?? -1;

// 押す操作だけで 1/2 + 1/3 を解く
function solvedFirstProblem(): LessonSession {
  let session = openTiles(createSession());
  session = pressRuler(selectPiece(session, "1/2"));
  session = pressRuler(selectPiece(session, "1/3"));
  session = selectPiece(session, "1/6");
  const [half, third] = [tileIdAt(session, 0), tileIdAt(session, 1)];
  for (const tileId of [half, half, half, third, third]) session = pressTile(session, tileId);
  return session;
}

// 式にもどって、タイルで数えた □ を入れた所
function filledReview(start = solvedFirstProblem()): LessonSession {
  return typePart(typePart(toReview(start), 0, "3"), 1, "2");
}

// □ が合って、続きの答えを聞いている所
const checkedReview = (start = solvedFirstProblem()): LessonSession => submitAnswer(filledReview(start));

describe("答える", () => {
  it("空の答えは判定しない", () => {
    expect(answered(createSession(), "  ").message).toBe("empty");
  });

  it("読めない答えは invalid、ちがう答えは wrong で、欄に残す", () => {
    const invalid = answered(createSession(), "わからない");
    expect(invalid.message).toBe("invalid");
    expect(invalid.rejectedAnswer).toBe("わからない");
    const wrong = answered(createSession(), "2/5");
    expect(wrong.message).toBe("wrongToTiles");
    expect(wrong.answerText).toBe("2/5");
    expect(wrong.isCorrect).toBe(false);
  });

  it("タイルを使わずに正解してもよい", () => {
    const session = answered(createSession(), "5/6");
    expect(session.isCorrect).toBe(true);
    expect(session.rejectedAnswer).toBeNull();
    expect(session.isCleared).toBe(false);
  });

  it("正解の後は答えを変えられない", () => {
    const session = answered(createSession(), "5/6");
    expect(typeAnswer(session, "1/2").answerText).toBe("5/6");
    expect(submitAnswer(session)).toBe(session);
  });
});

describe("式にもどる", () => {
  it("解けるまでは式にもどらない", () => {
    const session = openTiles(createSession());
    expect(toReview(session)).toBe(session);
  });

  it("もどった間も盤は残り、盤は変えられない", () => {
    const solved = solvedFirstProblem();
    expect(isSolved(solved.game)).toBe(true);
    const review = toReview(solved);
    expect(review.view).toBe("review");
    expect(review.message).toBe("backAligned");
    expect(review.game).toBe(solved.game);
    expect(isBoardLocked(review)).toBe(true);
    expect(pressTile(review, tileIdAt(review, 0))).toBe(review);
    expect(takeOffTile(review, tileIdAt(review, 0))).toBe(review);
    expect(clearTiles(review)).toBe(review);
    expect(applyDrop(review, drop({ key: "1/6", isOnRuler: false, tileId: tileIdAt(review, 0) }))).toBe(review);
  });

  it("まちがえたら、タイルへ戻るように伝え、解けた形のまま戻れる", () => {
    const wrong = answered(checkedReview(), "2/5");
    expect(wrong.message).toBe("wrongInReview");
    expect(wrong.rejectedAnswer).toBe("2/5");
    const back = toTiles(wrong);
    expect(back.view).toBe("work");
    expect(back.message).toBeNull();
    expect(isSolved(back.game)).toBe(true);
    expect(back.answerText).toBe("2/5");
  });

  it("正解の後はタイルへ戻らない", () => {
    const correct = answered(checkedReview(), "5/6");
    expect(toTiles(correct)).toBe(correct);
    expect(isBoardLocked(correct)).toBe(true);
  });
});

describe("次の問題とクリア", () => {
  it("正解するまでは次へ進まない", () => {
    const session = createSession();
    expect(nextProblem(session)).toBe(session);
  });

  it("次の問題は式だけの画面から始まる", () => {
    const next = nextProblem(answered(solvedFirstProblem(), "5/6"));
    expect(next.problemIndex).toBe(1);
    expect(next.view).toBe("answer");
    expect(next.answerText).toBe("");
    expect(next.game.tiles).toHaveLength(0);
    expect(next.shownHints).toBe(0);
  });

  it("最後の問題に正解した時だけクリアになる", () => {
    let session = createSession();
    for (const answer of ["5/6", "5/4"]) {
      session = answered(session, answer);
      expect(session.isCleared).toBe(false);
      session = nextProblem(session);
    }
    expect(session.problemIndex).toBe(LESSON.problems.length - 1);
    const cleared = answered(session, "1/2");
    expect(cleared.isCleared).toBe(true);
    expect(nextProblem(cleared)).toBe(cleared);
  });
});

describe("ヒント", () => {
  it("順に見せ、なくなったら文で伝える", () => {
    let session = showHint(createSession());
    expect(session.shownHints).toBe(1);
    session = showHint(showHint(session));
    expect(session.shownHints).toBe(3);
    expect(session.notice).toBeNull();
    session = showHint(session);
    expect(session.shownHints).toBe(3);
    expect(session.notice).toBe("no_more_hints");
  });
});

describe("タイルの操作", () => {
  it("もう一度押すと選ぶのをやめ、使い切ったタイルは文で伝える", () => {
    const session = openTiles(createSession());
    const selected = selectPiece(session, "1/2");
    expect(selected.selectedKey).toBe("1/2");
    expect(selectPiece(selected, "1/2").selectedKey).toBeNull();
    const placed = pressRuler(selected);
    expect(selectPiece(placed, "1/2")).toMatchObject({ selectedKey: null, notice: "none_left" });
  });

  it("選んだタイルを使い切ると選ぶのをやめ、次に押すと1段戻る", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    expect(session.selectedKey).toBeNull();
    session = selectPiece(session, "1/6");
    const tileId = tileIdAt(session, 0);
    for (let count = 0; count < 3; count += 1) session = pressTile(session, tileId);
    expect(session.selectedKey).toBe("1/6");
    expect(pressTile({ ...session, selectedKey: null }, tileId).game.tiles[0]?.coverCount).toBe(2);
  });

  it("選んでいなければ、ものさしの上のタイルを押すと1枚外す", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    const tileId = tileIdAt(session, 0);
    session = pressTile(selectPiece(session, "1/6"), tileId);
    expect(session.game.tiles[0]?.coverCount).toBe(1);
    session = pressTile(selectPiece(session, "1/6"), tileId);
    expect(session.game.tiles[0]?.coverCount).toBe(0);
  });

  it("ドラッグで置き、並べ替え、重ね、外へ出すと戻る", () => {
    let session = applyDrop(openTiles(createSession()), drop({ key: "1/2" }));
    session = applyDrop(session, drop({ key: "1/3", index: 0 }));
    expect(session.game.tiles.map((tile) => tile.key)).toEqual(["1/3", "1/2"]);
    session = applyDrop(session, drop({ key: "1/3", tileId: tileIdAt(session, 0), index: 1 }));
    expect(session.game.tiles.map((tile) => tile.key)).toEqual(["1/2", "1/3"]);
    session = applyDrop(session, drop({ key: "1/6", targetTileId: tileIdAt(session, 0) }));
    expect(session.game.tiles[0]?.coverCount).toBe(1);
    session = applyDrop(session, drop({ key: "1/2", tileId: tileIdAt(session, 0), isOnRuler: false }));
    expect(session.game.tiles.map((tile) => tile.key)).toEqual(["1/3"]);
  });

  it("重ねられないタイルを落としても盤は元のままで、文で伝える", () => {
    const start = applyDrop(openTiles(createSession()), drop({ key: "1/2" }));
    let session = start;
    for (let count = 0; count < 3; count += 1) session = applyDrop(session, drop({ key: "1/6", targetTileId: tileIdAt(session, 0) }));
    const full = applyDrop(session, drop({ key: "1/6", targetTileId: tileIdAt(session, 0) }));
    expect(full.game).toBe(session.game);
    expect(full.notice).toBe("already_full");
  });

  it("ものさしの上のタイルを重ねられないタイルへ落としても、重ねた内容は消えない", () => {
    let session = applyDrop(openTiles(createSession()), drop({ key: "1/2" }));
    session = applyDrop(session, drop({ key: "1/3", index: 1 }));
    for (let count = 0; count < 3; count += 1) session = applyDrop(session, drop({ key: "1/6", targetTileId: tileIdAt(session, 0) }));
    expect(session.game.tiles[0]?.coverCount).toBe(3);
    const moved = applyDrop(session, drop({ key: "1/2", tileId: tileIdAt(session, 0), targetTileId: tileIdAt(session, 1), isOnRuler: false }));
    expect(moved.game).toBe(session.game);
    expect(moved.game.tiles[0]?.coverCount).toBe(3);
  });

  it("置き場の外へ落としたタイルは何も変えない", () => {
    const session = openTiles(createSession());
    expect(applyDrop(session, drop({ key: "1/2", isOnRuler: false }))).toBe(session);
  });

  it("ぜんぶ戻すと盤と選んだタイルを空にする", () => {
    const session = clearTiles(selectPiece(solvedFirstProblem(), "1/6"));
    expect(session.game.tiles).toHaveLength(0);
    expect(session.selectedKey).toBeNull();
  });
});

describe("タイルで解く学習", () => {
  const tilesFirst: LessonDefinition = { id: "tiles", isTilesFirst: true, problems: [calculateProblem(f(1, 2), "+", f(1, 3)), plainProblem(f(1, 4), "+", f(1, 3))] };

  it("タイルから始まり、解いて式にもどるまで答えを受けない", () => {
    const session = startSession(tilesFirst);
    expect(session.view).toBe("work");
    expect(canAnswer(session)).toBe(false);
    expect(submitAnswer(typeAnswer(session, "5/6")).isCorrect).toBe(false);
  });

  it("式で考える類題は、式から始まる", () => {
    const session = startSession(tilesFirst, 1);
    expect(session.view).toBe("answer");
    expect(canAnswer(session)).toBe(true);
    expect(answered(session, "1/2").message).toBe("wrongToHints");
  });
});

describe("盤に置いたら、解けるまで答えを受けない（#377）", () => {
  const placedTwo = (): LessonSession => {
    let session = openTiles(createSession());
    session = pressRuler(selectPiece(session, "1/2"));
    return pressRuler(selectPiece(session, "1/3"));
  };

  it("1/2 と 1/3 だけ置いた未完成の盤では、5/6 と答えても受けない", () => {
    const session = placedTwo();
    expect(isSolved(session.game)).toBe(false);
    expect(canAnswer(session)).toBe(false);
    expect(submitAnswer(typeAnswer(session, "5/6")).isCorrect).toBe(false);
  });

  it("タイルを開いただけ（1枚も置かない）なら、今までどおり答えられる", () => {
    const session = openTiles(createSession());
    expect(canAnswer(session)).toBe(true);
    expect(answered(session, "5/6").isCorrect).toBe(true);
  });

  it("盤を空にすれば答えられる", () => {
    const session = clearTiles(placedTwo());
    expect(canAnswer(session)).toBe(true);
    expect(answered(session, "5/6").isCorrect).toBe(true);
  });

  it("盤が解ければ答えられる", () => {
    const session = solvedFirstProblem();
    expect(canAnswer(session)).toBe(true);
    expect(answered(session, "5/6").isCorrect).toBe(true);
  });

  it("式にもどった間は、盤が解けているので今までどおり", () => {
    expect(canAnswer(toReview(solvedFirstProblem()))).toBe(true);
  });
});

describe("分かんない", () => {
  const lesson: LessonDefinition = { id: "help", isTilesFirst: false, problems: [plainProblem(f(1, 4), "+", f(1, 3)), estimateProblem(f(3, 4), "+", f(1, 2), f(1, 1))] };

  it("式で考える類題は、ヒントを開ききると、同じ問題をタイルで考えられる。行き止まりにしない", () => {
    let session = pressHelp(startSession(lesson));
    expect(session).toMatchObject({ view: "answer", shownHints: 1, notice: null });
    session = pressHelp(session);
    expect(session).toMatchObject({ view: "answer", shownHints: 2, notice: "tiles_next" });
    session = pressHelp(session);
    expect(session).toMatchObject({ view: "work", shownHints: 2, notice: null });
    expect(session.problemIndex).toBe(0);
    // タイルに進んだ後のヒントは、タイルの話を続ける
    expect(showHint(session).shownHints).toBe(3);
  });

  it("タイルの無い見積もりは、ヒントが無くなると文で伝える", () => {
    let session = startSession(lesson, 1);
    session = pressHelp(pressHelp(session));
    expect(session).toMatchObject({ view: "answer", shownHints: 2, notice: null });
    expect(pressHelp(session)).toMatchObject({ view: "answer", notice: "no_more_hints" });
  });

  it("タイルのある問題は、すぐタイルを開く", () => {
    expect(pressHelp(createSession()).view).toBe("work");
  });
});

describe("式にもどった時の □", () => {
  it("入れるまで答えを判定せず、数がちがえばタイルを数えるように伝える", () => {
    const review = toReview(solvedFirstProblem());
    expect(submitAnswer(review).message).toBe("alignedEmpty");
    expect(submitAnswer(typePart(typePart(review, 0, "2"), 1, "2")).message).toBe("alignedWrong");
    expect(submitAnswer(typePart(typePart(review, 0, "３"), 1, "2")).message).toBe("alignedRight");
  });

  it("□ が合うと、□ が合ったことを伝え、式に残して続きの答えを聞く", () => {
    const checked = submitAnswer(filledReview());
    expect(checked).toMatchObject({ message: "alignedRight", isAlignedChecked: true, isCorrect: false });
    expect(needsAligned(checked)).toBe(false);
    expect(showsAligned(checked)).toBe(true);
    expect(answered(checked, "").message).toBe("empty");
    expect(answered(checked, "5/6").isCorrect).toBe(true);
  });

  it("前の誤答が欄に残っていても □ の判定に混ぜず、合ったら欄を空にする", () => {
    const stale = answered(openTiles(createSession()), "2/7");
    expect(stale.rejectedAnswer).toBe("2/7");
    const solved = { ...solvedFirstProblem(), answerText: stale.answerText, rejectedAnswer: stale.rejectedAnswer };
    expect(submitAnswer(toReview(solved)).message).toBe("alignedEmpty");
    const checked = checkedReview(solved);
    expect(checked).toMatchObject({ message: "alignedRight", answerText: "", rejectedAnswer: null });
  });

  it("タイルへ戻って式にもどっても、合った □ を聞き直さない", () => {
    const wrong = answered(checkedReview(), "2/5");
    const again = toReview(toTiles(wrong));
    expect(needsAligned(again)).toBe(false);
    expect(again.message).toBe("back");
    expect(again.answerText).toBe("2/5");
  });

  it("まい数は、足した計算で盤が解けている時だけ見せる", () => {
    expect(showsCount(answered(checkedReview(), "5/6"))).toBe(true);
    expect(showsCount(answered(createSession(), "5/6"))).toBe(false);
  });
});

describe("約分", () => {
  const lesson: LessonDefinition = { id: "reduce", isTilesFirst: false, problems: [reduceProblem(f(4, 6), f(1, 2))] };

  it("同じ大きさでも、約分しきっていなければ正解にしない", () => {
    expect(answered(startSession(lesson), "4/6")).toMatchObject({ isCorrect: false, message: "notLowest" });
    expect(answered(startSession(lesson), "2/3").isCorrect).toBe(true);
    expect(answered(startSession(lesson), "1/3").message).toBe("wrongToTiles");
  });

  it("大きいタイルで2まいにうめると解ける。うまらないタイルは文で伝える", () => {
    let session = pressRuler(selectPiece(openTiles(startSession(lesson)), "4/6"));
    const tileId = tileIdAt(session, 0);
    session = pressTile(selectPiece(session, "1/2"), tileId);
    expect(session.notice).toBe("no_fit");
    session = selectPiece({ ...session, selectedKey: null }, "1/3");
    session = pressTile(pressTile(session, tileId), tileId);
    expect(isSolved(session.game)).toBe(true);
    const review = typePart(toReview(session), 0, "2");
    expect(submitAnswer(typePart(review, 0, "1")).message).toBe("alignedWrong");
    // □ の分数がそのまま答えなので、同じ答えを入れ直さない
    expect(submitAnswer(review)).toMatchObject({ isCorrect: true, message: "correct" });
  });

  it("うめるタイルを先に押しても端に置かず、先に置くタイルを伝える", () => {
    const session = pressRuler(selectPiece(openTiles(startSession(lesson)), "1/3"));
    expect(session.notice).toBe("place_first");
    expect(session.game.tiles).toHaveLength(0);
  });

  it("うまらないタイルは、押しても重ねず文で伝える", () => {
    const placed = pressRuler(selectPiece(openTiles(startSession(lesson)), "4/6"));
    const session = pressRuler(selectPiece(placed, "1/2"));
    expect(session.notice).toBe("no_fit");
    expect(session.game).toBe(placed.game);
  });

  it("ドラッグで端に落としたら、上に重ねるように伝える", () => {
    const session = applyDrop(openTiles(startSession(lesson)), drop({ key: "1/3" }));
    expect(session.notice).toBe("cover_tile");
  });
});

describe("通分", () => {
  const lesson: LessonDefinition = { id: "common", isTilesFirst: false, problems: [commonProblem(f(1, 2), f(1, 3))] };
  const pair = (left: string, right: string) => submitAnswer(typePart(typePart(startSession(lesson), 0, left), 1, right));

  it("分母がそろっていれば、6 でも 12 でも正解にする", () => {
    expect(pair("3/6", "2/6").isCorrect).toBe(true);
    expect(pair("6/12", "4/12").isCorrect).toBe(true);
  });

  it("大きさが合っていても分母がちがえば、そろえるように伝える", () => {
    expect(pair("3/6", "4/12").message).toBe("notCommon");
    expect(pair("3/6", "3/6").message).toBe("wrongToTiles");
    expect(pair("3/6", "").message).toBe("empty");
    expect(pair("3/6", "にぶんのいち").message).toBe("invalid");
  });
});

describe("くらべると見積もり", () => {
  const lessonOf = (problem: LessonDefinition["problems"][number]): LessonDefinition => ({ id: "choice", isTilesFirst: false, problems: [problem] });

  it("答えは分数の値から決まる", () => {
    expect(correctChoice(startSession(lessonOf(compareProblem(f(1, 2), f(2, 5)))))).toBe("left");
    expect(correctChoice(startSession(lessonOf(compareProblem(f(5, 8), f(3, 4)))))).toBe("right");
    expect(correctChoice(startSession(lessonOf(compareProblem(f(2, 3), f(4, 6)))))).toBe("same");
    expect(correctChoice(startSession(lessonOf(estimateProblem(f(3, 4), "+", f(1, 2), f(1, 1)))))).toBe("above");
    expect(correctChoice(startSession(lessonOf(estimateProblem(f(1, 5), "+", f(1, 4), f(1, 1)))))).toBe("below");
  });

  it("まちがえると文を出し、正しい選択で正解になる", () => {
    const session = startSession(lessonOf(compareProblem(f(1, 2), f(2, 5))));
    expect(submitChoice(session, "right")).toMatchObject({ isCorrect: false, message: "wrongToTiles" });
    expect(submitChoice(session, "left").isCorrect).toBe(true);
  });

  it("くらべる問題は入れる欄が無いので、式にもどった時は選ぶように伝える。足していないのでまい数も出さない", () => {
    let session = openTiles(startSession(lessonOf(compareProblem(f(1, 2), f(1, 3)))));
    session = pressRuler(selectPiece(session, "1/2"));
    session = pressRuler(selectPiece(session, "1/3"));
    session = selectPiece(session, "1/6");
    for (let count = 0; count < 5; count += 1) session = pressRuler(session);
    expect(isSolved(session.game)).toBe(true);
    const review = toReview(session);
    expect(review.message).toBe("backChoice");
    const correct = submitChoice(review, "left");
    expect(correct.isCorrect).toBe(true);
    expect(showsCount(correct)).toBe(false);
  });
});

describe("うめるタイルの置き場所", () => {
  it("ドラッグでじかに置いたら、重ねるように文で伝える。置くこと自体は止めない", () => {
    const dropped = applyDrop(openTiles(createSession()), drop({ key: "1/6" }));
    expect(dropped.game.tiles).toHaveLength(1);
    expect(dropped.notice).toBe("loose_unit");
  });

  it("式の分数のタイルでは文を出さない", () => {
    expect(pressRuler(selectPiece(openTiles(createSession()), "1/2")).notice).toBeNull();
  });

  it("式のタイルが無い間に押すと、端に置かず、先に置くタイルを伝える", () => {
    const session = pressRuler(selectPiece(openTiles(createSession()), "1/6"));
    expect(session.game.tiles).toHaveLength(0);
    expect(session.notice).toBe("place_first");
  });

  it("ものさしに置くを続けて押すと、空きのあるタイルへ順に重なり、解ける", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    session = pressRuler(selectPiece(session, "1/3"));
    session = selectPiece(session, "1/6");
    for (let count = 0; count < 5; count += 1) {
      session = pressRuler(session);
      expect(session.notice).toBeNull();
    }
    expect(session.game.tiles.map((tile) => tile.coverCount)).toEqual([3, 2]);
    expect(isSolved(session.game)).toBe(true);
  });

  it("解けたら選ぶのをやめ、そのあと選び直して押しても、ものさしは伸びない", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    session = pressRuler(selectPiece(session, "1/3"));
    session = selectPiece(session, "1/6");
    for (let count = 0; count < 5; count += 1) session = pressRuler(session);
    expect(session.selectedKey).toBeNull();
    const full = pressRuler(selectPiece(session, "1/6"));
    expect(full.game).toBe(session.game);
    expect(full).toMatchObject({ notice: "already_full", selectedKey: null });
  });

  it("ひき算は、うめた後に押すと上に重ねて取る。うめる前は順番を伝える", () => {
    const lesson: LessonDefinition = { id: "take", isTilesFirst: false, problems: [calculateProblem(f(5, 6), "-", f(1, 3))] };
    let session = pressRuler(selectPiece(openTiles(startSession(lesson)), "5/6"));
    const early = pressRuler(selectPiece(session, "1/3"));
    expect(early.notice).toBe("fill_first");
    session = selectPiece({ ...early, selectedKey: null, notice: null }, "1/6");
    for (let count = 0; count < 5; count += 1) session = pressRuler(session);
    session = pressRuler(selectPiece({ ...session, selectedKey: null }, "1/3"));
    expect(isSolved(session.game)).toBe(true);
  });
});

describe("ものさしのタイルを押して戻す", () => {
  it("重ねたタイルを1枚ずつ戻し、戻すものが無くなるとタイルを外す", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    const tileId = tileIdAt(session, 0);
    session = pressTile(selectPiece(session, "1/6"), tileId);
    session = pressTile({ ...session, selectedKey: null }, tileId);
    expect(session.game.tiles[0]?.coverCount).toBe(0);
    session = pressTile(session, tileId);
    expect(session.game.tiles).toHaveLength(0);
  });

  it("いっぱいのタイルに押した後は、続けて押すと1枚戻る", () => {
    let session = pressRuler(selectPiece(openTiles(createSession()), "1/2"));
    const tileId = tileIdAt(session, 0);
    session = selectPiece(session, "1/6");
    for (let count = 0; count < 3; count += 1) session = pressTile(session, tileId);
    session = pressTile(session, tileId);
    expect(session).toMatchObject({ notice: "already_full", selectedKey: null });
    expect(pressTile(session, tileId).game.tiles[0]?.coverCount).toBe(2);
  });
});

describe("わり算と分数", () => {
  const lesson: LessonDefinition = { id: "divide", isTilesFirst: false, problems: [divideProblem(3, 4), divideProblem(6, 3)] };

  it("タイルを使わずに答える。約分しない形も正解、ちがう値は不正解", () => {
    expect(answered(startSession(lesson), "3/4")).toMatchObject({ isCorrect: true, message: "correct" });
    expect(answered(startSession(lesson), "6/8").isCorrect).toBe(true);
    expect(answered(startSession(lesson), "4/3")).toMatchObject({ isCorrect: false, message: "wrongToTiles" });
    expect(answered(startSession(lesson), "").message).toBe("empty");
    expect(answered(startSession(lesson), "あ").message).toBe("invalid");
  });

  it("わり切れる時は、整数でも約分しない分数でも正解", () => {
    const six = nextProblem(answered(startSession(lesson), "3/4"));
    expect(answered(six, "2").isCorrect).toBe(true);
    expect(answered(six, "6/3").isCorrect).toBe(true);
    expect(answered(six, "3").isCorrect).toBe(false);
  });

  it("タイルを開いて並べ、式にもどって答える。□ の段は無い", () => {
    let session = openTiles(startSession(lesson));
    expect(session.view).toBe("work");
    session = selectPiece(session, "1/4");
    for (let count = 0; count < 3; count += 1) session = pressRuler(session);
    expect(isSolved(session.game)).toBe(true);
    expect(session.notice).toBeNull();
    session = toReview(session);
    expect(session).toMatchObject({ view: "review", message: "back" });
    expect(needsAligned(session)).toBe(false);
    expect(showsAligned(session)).toBe(false);
    expect(showsCount(session)).toBe(false);
    expect(answered(session, "1/4")).toMatchObject({ isCorrect: false, message: "wrongInReview" });
    expect(answered(session, "3/4")).toMatchObject({ isCorrect: true, message: "correct" });
  });

  it("ドラッグで置いても、重ねるようには案内しない", () => {
    const session = applyDrop(openTiles(startSession(lesson)), drop({ key: "1/4" }));
    expect(session.notice).toBeNull();
    expect(session.game.tiles).toHaveLength(1);
  });

  it("答えの図は出さず、つまずきの記録の対象でもない", () => {
    const wrong = answered(startSession(lesson), "4/3");
    expect(answerGap(wrong)).toBeNull();
    expect(isRecordableWrong(startSession(lesson), wrong)).toBe(false);
  });
});

describe("同じ大きさの分数", () => {
  const lesson: LessonDefinition = { id: "equivalent", isTilesFirst: false, problems: [equivalentProblem(f(1, 2), 4), equivalentProblem(f(4, 6), 3)] };

  it("タイルを使わずに答える。答えは □ の分子だけ", () => {
    expect(answered(startSession(lesson), "2")).toMatchObject({ isCorrect: true, message: "correct" });
    expect(answered(startSession(lesson), "２").isCorrect).toBe(true);
    expect(answered(startSession(lesson), "3")).toMatchObject({ isCorrect: false, message: "wrongToTiles" });
    expect(answered(startSession(lesson), "").message).toBe("empty");
    expect(answered(startSession(lesson), "2/4")).toMatchObject({ isCorrect: false, message: "alignedEmpty" });
  });

  it("タイルを開いて解き、式にもどると □ がそのまま答えになる", () => {
    let session = pressRuler(selectPiece(openTiles(startSession(lesson)), "1/2"));
    const tileId = tileIdAt(session, 0);
    session = selectPiece(session, "1/4");
    session = pressTile(pressTile(session, tileId), tileId);
    expect(isSolved(session.game)).toBe(true);
    const review = toReview(session);
    expect(needsAligned(review)).toBe(true);
    expect(showsCount(review)).toBe(false);
    expect(submitAnswer(review).message).toBe("alignedEmpty");
    expect(submitAnswer(typePart(review, 0, "3")).message).toBe("alignedWrong");
    expect(submitAnswer(typePart(review, 0, "2"))).toMatchObject({ isCorrect: true, message: "correct" });
  });

  it("大きいタイルでうめる問題（4/6 = □/3）も同じ流れで解ける", () => {
    let session = nextProblem(answered(startSession(lesson), "2"));
    session = pressRuler(selectPiece(openTiles(session), "4/6"));
    session = selectPiece(session, "1/3");
    session = pressTile(pressTile(session, tileIdAt(session, 0)), tileIdAt(session, 0));
    expect(isSolved(session.game)).toBe(true);
    expect(submitAnswer(typePart(toReview(session), 0, "2")).isCorrect).toBe(true);
  });

  it("答えの図は出さず、つまずきの記録の対象でもない", () => {
    const wrong = answered(startSession(lesson), "3");
    expect(answerGap(wrong)).toBeNull();
    expect(isRecordableWrong(startSession(lesson), wrong)).toBe(false);
  });
});

/* ---------- 数の問題（D-132） ---------- */

const numberProblem = (topic: NumberTopic, answer: NumberAnswer, hints = ["ヒント1", "ヒント2"]): NumberProblem => ({ kind: "number", pieces: [], hints, topic, answer });

const DECIMAL = numberProblem(
  { t: "multiply", a: "12", b: "4.3", intA: 12, intB: 43, intProduct: 516, places: 1, answer: "51.6" },
  { type: "decimal", value: "51.6" },
);
const INTEGER = numberProblem({ t: "lcm", a: 4, b: 6, answer: 12 }, { type: "integer", value: 12 });
const CHOICE = numberProblem({ t: "parity", n: 7, even: false }, { type: "choice", options: ["even", "odd"], correct: "odd" });
const MULTI = numberProblem({ t: "divisors", n: 8, list: [1, 2, 4, 8] }, { type: "multi", cards: [1, 2, 3, 4, 5, 6, 7, 8], correct: [1, 2, 4, 8] });
const REMAINDER = numberProblem(
  { t: "divideRemainder", a: "7.5", b: "2.3", quotient: 3, remainder: "0.6" },
  { type: "remainder", quotient: 3, remainder: "0.6" },
);
const TABLE = numberProblem(
  { t: "tableBlank", rule: { form: "add", a: 2, b: 0 }, table: [{ x: "1", y: "3" }, { x: "2", y: null }, { x: "3", y: "5" }], x: "2", answer: "4" },
  { type: "decimal", value: "4" },
);
const FRACTION = numberProblem(
  { t: "decimalToFraction", decimal: "0.13", unit: f(1, 100), count: 13, value: f(13, 100) },
  { type: "fraction", value: f(13, 100) },
);
const NUMERATOR = numberProblem({ t: "intToFraction", n: 2, den: 3, count: 6 }, { type: "numerator", value: 6 });

const numberLesson = (...problems: NumberProblem[]): LessonDefinition => ({ id: "number-fixture", isTilesFirst: false, problems });

describe("数の問題：数を入れる", () => {
  const start = () => startSession(numberLesson(DECIMAL, INTEGER));

  it("タイルは開かず、答えの欄がはじめから使える。「分かんない」はヒントを1つずつ開く", () => {
    const session = start();
    expect(session.view).toBe("answer");
    expect(canAnswer(session)).toBe(true);
    expect(openTiles(session)).toBe(session);
    const first = pressHelp(session);
    expect(first).toMatchObject({ shownHints: 1, view: "answer", notice: null });
    expect(pressHelp(first).shownHints).toBe(2);
    expect(pressHelp(pressHelp(first)).notice).toBe("no_more_hints");
  });

  it("空は empty、読めない答えは CP-603 の文で、間違いに数えない", () => {
    expect(answered(start(), " ").message).toBe("empty");
    const invalid = answered(start(), "1.2.3");
    expect(invalid).toMatchObject({ message: "invalidDecimal", rejectedAnswer: "1.2.3", isCorrect: false });
    expect(answered(start(), "あ").message).toBe("invalidDecimal");
    expect(answered(start(), "1".repeat(41)).message).toBe("invalidDecimal");
  });

  it("まちがいは「分かんない」へ誘い、欄に残す", () => {
    const wrong = answered(start(), "5.16");
    expect(wrong).toMatchObject({ message: "wrongToHints", rejectedAnswer: "5.16", answerText: "5.16" });
    expect(answerGap(wrong)).toBeNull();
    expect(isRecordableWrong(start(), wrong)).toBe(false);
  });

  it("正解（0.50 のような書き方も全角も同じ）は次の問題へ進める", () => {
    for (const text of ["51.6", "51.60", "５１．６"]) {
      const right = answered(start(), text);
      expect(right).toMatchObject({ isCorrect: true, message: "correct", isCleared: false });
      expect(answered(right, "1")).toBe(right);
      expect(nextProblem(right).problemIndex).toBe(1);
    }
  });

  it("整数の欄は、小数を読めない答えにする", () => {
    const session = nextProblem(answered(start(), "51.6"));
    expect(answered(session, "1.5").message).toBe("invalidInteger");
    expect(answered(session, "13").message).toBe("wrongToHints");
    expect(answered(session, "12")).toMatchObject({ isCorrect: true, isCleared: true });
  });
});

describe("数の問題：分数・分子だけ・表の □", () => {
  it("分数は約分していなくても正解。読めなければ今の invalid", () => {
    const start = () => startSession(numberLesson(FRACTION));
    expect(answered(start(), "26/200").isCorrect).toBe(true);
    expect(answered(start(), "0.13").message).toBe("invalid");
    expect(answered(start(), "13/10").message).toBe("wrongToHints");
  });

  it("□ のある式の分子だけを入れる", () => {
    const start = () => startSession(numberLesson(NUMERATOR));
    expect(answered(start(), "").message).toBe("empty");
    expect(answered(start(), "6/1").message).toBe("invalidInteger");
    expect(answered(start(), "5").message).toBe("wrongToHints");
    expect(answered(start(), "6").isCorrect).toBe(true);
  });

  it("表の □ に入る数は、小数の判定と同じ", () => {
    const start = () => startSession(numberLesson(TABLE));
    expect(answered(start(), "").message).toBe("empty");
    expect(answered(start(), "4.5.1").message).toBe("invalidDecimal");
    expect(answered(start(), "5").message).toBe("wrongToHints");
    expect(answered(start(), "4.0")).toMatchObject({ isCorrect: true, isCleared: true });
  });
});

describe("数の問題：1つ選ぶ", () => {
  const start = () => startSession(numberLesson(CHOICE, INTEGER));

  it("選択肢を押して答える。「こたえる」では答えない", () => {
    expect(submitAnswer(start())).toEqual(start());
    expect(submitNumberChoice(start(), "even")).toMatchObject({ message: "wrongToHints", isCorrect: false });
    const right = submitNumberChoice(start(), "odd");
    expect(right).toMatchObject({ isCorrect: true, message: "correct" });
    expect(submitNumberChoice(right, "even")).toBe(right);
    expect(nextProblem(right).problemIndex).toBe(1);
  });

  it("選ぶ問題でない時は何もしない", () => {
    const session = startSession(numberLesson(INTEGER));
    expect(submitNumberChoice(session, "odd")).toBe(session);
  });
});

describe("数の問題：全部えらぶ", () => {
  const start = () => startSession(numberLesson(MULTI, INTEGER));
  const pick = (session: LessonSession, ...cards: number[]) => cards.reduce(togglePick, session);

  it("札は押すたびに出し入れし、小さい順に持つ", () => {
    const session = pick(start(), 4, 1, 8);
    expect(session.picked).toEqual([1, 4, 8]);
    expect(togglePick(session, 4).picked).toEqual([1, 8]);
  });

  it("何も選ばずに答えると CP-606、足りないと CP-607、入らない数がまじると CP-608", () => {
    expect(submitAnswer(start()).message).toBe("multiEmpty");
    expect(submitAnswer(pick(start(), 1, 2)).message).toBe("multiMissing");
    expect(submitAnswer(pick(start(), 1, 2, 4, 8, 5)).message).toBe("multiExtra");
    expect(submitAnswer(pick(start(), 1, 3)).message).toBe("multiExtra");
  });

  it("答えの組と同じなら正解。正解の後は札を押せず、選んだまま残る", () => {
    const right = submitAnswer(pick(start(), 8, 4, 2, 1));
    expect(right).toMatchObject({ isCorrect: true, message: "correct" });
    expect(togglePick(right, 3)).toBe(right);
    expect(togglePick(right, 1)).toBe(right);
    expect(right.picked).toEqual([1, 2, 4, 8]);
    expect(nextProblem(right)).toMatchObject({ problemIndex: 1, picked: [] });
  });
});

describe("数の問題：商とあまり", () => {
  const start = () => startSession(numberLesson(REMAINDER));
  const filled = (quotient: string, remainder: string) => typePart(typePart(start(), 0, quotient), 1, remainder);

  it("どちらかが空なら CP-611", () => {
    expect(submitAnswer(start()).message).toBe("remainderEmpty");
    expect(submitAnswer(filled("3", " ")).message).toBe("remainderEmpty");
    expect(submitAnswer(filled("", "0.6")).message).toBe("remainderEmpty");
  });

  it("読めなければ欄に合わせた文、違えば wrongToHints、合えば正解", () => {
    expect(submitAnswer(filled("3.2", "0.6")).message).toBe("invalidInteger");
    expect(submitAnswer(filled("3", "0.6.1")).message).toBe("invalidDecimal");
    expect(submitAnswer(filled("3", "0.5")).message).toBe("wrongToHints");
    expect(submitAnswer(filled("2", "0.6")).message).toBe("wrongToHints");
    expect(submitAnswer(filled("3", "0.60"))).toMatchObject({ isCorrect: true, isCleared: true });
  });
});

describe("数の問題：正解の後の一言", () => {
  it("問題の種類ごとの文を出す", () => {
    const session = startSession(numberLesson(DECIMAL));
    expect(afterParts(DECIMAL, session.game, "")).toEqual(["12×43 = 516 の[積|せき]の[小数点|しょうすうてん]を、[左|ひだり]へ 1けたうつします"]);
  });
});

describe("タイルの問題と数の問題がまざった学習", () => {
  const mixed: LessonDefinition = {
    id: "mixed",
    isTilesFirst: true,
    problems: [calculateProblem(f(1, 2), "+", f(1, 3)), INTEGER, calculateProblem(f(1, 2), "+", f(1, 4)), CHOICE],
  };

  it("問題ごとにタイルと数が切り替わる。数の問題はタイルを先に開かない", () => {
    const first = startSession(mixed);
    expect(first.view).toBe("work");
    expect(canAnswer(first)).toBe(false);
    expect(first.game.tiles).toHaveLength(0);

    const second = startSession(mixed, 1);
    expect(second.view).toBe("answer");
    expect(canAnswer(second)).toBe(true);
    expect(second.game.pieces).toEqual([]);
    expect(answered(second, "12").isCorrect).toBe(true);

    const third = nextProblem(answered(second, "12"));
    expect(third).toMatchObject({ problemIndex: 2, view: "work", picked: [], shownHints: 0, answerText: "" });
    expect(third.game.pieces.length).toBeGreaterThan(0);

    const last = startSession(mixed, 3);
    expect(submitNumberChoice(last, "odd")).toMatchObject({ isCorrect: true, isCleared: true });
  });

  it("数の問題の後に、タイルの問題の判定が混ざらない", () => {
    const tile = nextProblem(answered(startSession(mixed, 1), "12"));
    expect(submitAnswer(tile)).toBe(tile);
  });
});
