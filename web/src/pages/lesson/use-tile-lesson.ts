import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { seForAnswer } from "../../audio/se";
import { playSe } from "../../audio/use-bgm";
import { saveResume } from "../../game/lesson-resume";
import type { LessonDefinition } from "../../lesson/problems";
import {
  applyDrop, clearTiles, createSession, currentProblem, isBoardLocked, nextProblem, pressHelp, pressRuler, pressTile, selectPiece, showHint, submitAnswer,
  submitChoice, submitNumberChoice, takeOffTile, toReview, toTiles, togglePick, typeAnswer, typePart,
} from "../../lesson/session";
import type { LessonChoice, LessonSession, TileDrop } from "../../lesson/session";
import { applyApprovedHints, loadApprovedHints } from "../../lesson/approved-hints";
import { reportIfRecordable, reportPrintFractionWrong } from "../../lesson/stumble-reporter";
import { isSolved, scrollBehaviorFor } from "../../lesson/tiles";
import { useIdleNudge } from "./use-idle-nudge";

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToNode(node: Element | null, block: ScrollLogicalPosition) {
  if (!node) return;
  const behavior = scrollBehaviorFor(prefersReducedMotion());
  // 767px 以下はカードの枠を外して（display: contents）上と下を固定する（D-238）。枠に箱が無く scrollIntoView が効かないので、ページの一番上へ戻す
  if (typeof getComputedStyle === "function" && getComputedStyle(node).display === "contents") {
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior });
    return;
  }
  node.scrollIntoView({ behavior, block });
}

// 画面が描き変わった後にしか、スクロール先やフォーカス先は無い
function useAfterRender(): (run: () => void) => void {
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    const run = pending.current;
    pending.current = null;
    run?.();
  });
  return useCallback((run) => { pending.current = run; }, []);
}

/** 手が止まった時に光らせるボタン。answer は「分かんない」、hint は「次のヒント」。ヒントそのものは本人が押すまで出さない */
export type NudgeTarget = "help" | "hint";

function nudgeTargetOf(session: LessonSession): NudgeTarget | null {
  if (session.isCorrect || session.isCleared) return null;
  if (session.view === "answer") return "help";
  const hasMoreHints = session.shownHints < currentProblem(session).hints.length;
  return session.view === "work" && !isBoardLocked(session) && hasMoreHints ? "hint" : null;
}

function focusLastButton(root: HTMLElement | null) {
  const buttons = root?.querySelectorAll<HTMLElement>("button:not(:disabled)");
  buttons?.item(buttons.length - 1)?.focus({ preventScroll: true });
}

/**
 * preview：間違いの送信も続きの保存も止める（スタジオの試し）。
 * handoutId：配られた 1 問を解く時。間違いは handoutId つきで送るが、続きの保存はしない。どちらも既定は章の学習の動き
 */
export function useTileLesson(lesson: LessonDefinition, startIndex: number, options: { preview?: boolean; handoutId?: string } = {}) {
  const isPreview = options.preview ?? false;
  const { handoutId } = options;
  const [session, setSession] = useState<LessonSession>(() => createSession(lesson, startIndex));
  // 押した時の音を決めるために、押した時点の状態を読む
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; });
  const afterRender = useAfterRender();
  const cardRef = useRef<HTMLElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const workRef = useRef<HTMLElement>(null);
  const backRowRef = useRef<HTMLDivElement>(null);
  const clearRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const nudgeTarget = nudgeTargetOf(session);
  const isNudged = useIdleNudge(mainRef, nudgeTarget !== null, `${session.problemIndex}`, session);
  // 同じ文が続くと画面も読み上げも変わらないので、答えるたびに文を置き直す
  const [answerTry, setAnswerTry] = useState(0);

  // 残っている答えのうしろに打ち足さないように、欄にもどったら中身を選ぶ。そのまま打てば置きかわる。
  // フォーカスがないときは選ばない。ブラウザによってはフォーカスが移り、スマホのキーボードが開く
  const selectRejectedAnswer = useCallback((rejected: string | null) => {
    const answer = answerRef.current;
    if (answer && document.activeElement === answer && answer.value === rejected) answer.select();
  }, []);

  // 解けた時だけ知らせる。解けたまま並べ替えても、式から戻っても、もう一度はスクロールしない
  const isGameSolved = isSolved(session.game);
  useEffect(() => {
    if (!isGameSolved) return;
    playSe("solved");
    scrollToNode(backRowRef.current, "nearest");
  }, [isGameSolved]);

  // タイルがものさしに増えた時だけ鳴らす（置けなかった、取った、次の問題で空になった時は鳴らさない）
  const tileCount = session.game.tiles.length;
  const lastTileCount = useRef(tileCount);
  useEffect(() => {
    if (tileCount > lastTileCount.current) playSe("place", tileCount - 1);
    lastTileCount.current = tileCount;
  }, [tileCount]);

  const answered = (next: LessonSession) => {
    // 結果の音が無い時（空欄や約分の注意）は、押した手応えとして決定の音（D-104）。
    // 全部えらぶ問題の「足りない」「入らない数がまじる」は間違いなので、間違いの音
    const isWrongPick = next.message === "multiMissing" || next.message === "multiExtra";
    playSe(seForAnswer(next) ?? (isWrongPick ? "wrong" : "enter"));
  };

  const onAnswer = (event: FormEvent) => {
    event.preventDefault();
    const next = submitAnswer(session);
    // デモの時だけ、型つきで API に送る。既定では何もしない（stumble-reporter.ts）
    const target = isPreview ? null : handoutId ? reportPrintFractionWrong(session, next, handoutId) : reportIfRecordable(session, next);
    // 型が分かった子には、その型で承認された直し方を、最初のヒントにする（輪の最後。デモの設定のときだけ）
    if (target) {
      void loadApprovedHints(target).then((hints) => setSession((current) => applyApprovedHints(current, target.problemIndex, hints)));
    }
    setSession(next);
    answered(next);
    setAnswerTry((count) => count + 1);
    afterRender(() => {
      if (next.isCleared) scrollToNode(clearRef.current, "nearest");
      // 押した「こたえる」は正解で消えるので、次にすること（つぎの問題へ／クリアのボタン）へ移す
      if (next.isCorrect) focusLastButton(next.isCleared ? clearRef.current : cardRef.current);
      else if (next.message === "alignedRight") answerRef.current?.focus({ preventScroll: true });
      else selectRejectedAnswer(next.rejectedAnswer);
    });
  };

  const onAnswerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setSession((current) => typeAnswer(current, value));
  };

  const onPartChange = (index: 0 | 1) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setSession((current) => typePart(current, index, value));
  };

  const finishChoice = (next: LessonSession) => {
    setSession(next);
    answered(next);
    setAnswerTry((count) => count + 1);
    afterRender(() => {
      if (next.isCleared) scrollToNode(clearRef.current, "nearest");
      // 押した選択肢が消えると、キーボードの人が場所を見失う
      if (next.isCorrect) focusLastButton(next.isCleared ? clearRef.current : cardRef.current);
    });
  };

  const onChoice = (choice: LessonChoice) => finishChoice(submitChoice(session, choice));

  // 数の問題の、1つ選ぶ選択肢と、全部えらぶ札
  const onNumberChoice = (id: string) => finishChoice(submitNumberChoice(session, id));

  const onPick = (card: number) => setSession((current) => togglePick(current, card));

  // タイルを開いたら問題の上端へ送る。タイルの所へ送ると、見くらべたい式が画面の上で切れる
  const onHelp = () => {
    const next = pressHelp(session);
    setSession(next);
    if (next.view !== "work") return;
    afterRender(() => {
      scrollToNode(cardRef.current, "start");
      // 押した「分かんない」は消えるので、タイルの中へ移す
      workRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    });
  };

  const onBack = () => {
    setSession(toReview);
    afterRender(() => {
      scrollToNode(cardRef.current, "start");
      // □ があれば、まず □ から入れてもらう
      const firstInput = cardRef.current?.querySelector<HTMLElement>(".lesson-slot") ?? answerRef.current;
      firstInput?.focus({ preventScroll: true });
      selectRejectedAnswer(session.rejectedAnswer);
    });
  };

  const onReturnToTiles = () => {
    setSession(toTiles);
    afterRender(() => {
      scrollToNode(workRef.current, "start");
      // Button は ref を受けないので、もどる所の中のボタンを探す
      backRowRef.current?.querySelector("button")?.focus({ preventScroll: true });
    });
  };

  const onNext = () => {
    const next = nextProblem(session);
    setSession(next);
    if (!isPreview && !handoutId) saveResume(next.lesson, next.problemIndex);
    afterRender(() => {
      scrollToNode(cardRef.current, "start");
      // タイルから始める問題には入力欄も選択肢も無い。カードの先頭のボタンは「通分の例を見る」なので、
      // 続けて押した（Enter の連打）時に例のダイアログが開く。タイルの中へ移す
      const root = next.view === "work" ? workRef.current : cardRef.current;
      // 選択肢の問題には入力欄が無い。最初の選択肢へ移すと、続けて押した Enter がその選択肢を答えとして送ってしまう。
      // 選択肢の手前（問題の見出し）へ移す。見出しの次の Tab で選択肢に入れる
      if (!answerRef.current && next.view !== "work" && root?.querySelector(".lesson-choice")) {
        root.querySelector<HTMLElement>("#lesson-problem-heading")?.focus({ preventScroll: true });
        return;
      }
      const first = answerRef.current ?? root?.querySelector<HTMLElement>("button:not(:disabled)");
      first?.focus({ preventScroll: true });
    });
  };

  const tiles = useMemo(() => {
    // 押したボタンが消えるとフォーカスが body に落ちて、キーボードと読み上げの人が場所を見失う。
    // ものさしのタイルか、無ければ置き場のタイルへ移す
    const keepFocusInWork = () => afterRender(() => {
      if (document.activeElement !== document.body) return;
      workRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    });
    // 押しても置けなかった時だけ選ぶ音（D-104）。置けた時は上の effect が置いた音を鳴らす
    const pressSound = (press: (current: LessonSession) => LessonSession) => {
      const before = sessionRef.current;
      if (press(before).game.tiles.length <= before.game.tiles.length) playSe("select");
    };
    return {
      onDrop: (drop: TileDrop) => setSession((current) => applyDrop(current, drop)),
      onSelectPiece: (key: string) => {
        playSe("select");
        setSession((current) => selectPiece(current, key));
      },
      onPressTile: (tileId: number) => {
        pressSound((current) => pressTile(current, tileId));
        setSession((current) => pressTile(current, tileId));
        keepFocusInWork();
      },
      onPressRuler: () => {
        pressSound(pressRuler);
        setSession(pressRuler);
        keepFocusInWork();
      },
      onTakeOff: (tileId: number) => {
        setSession((current) => takeOffTile(current, tileId));
        keepFocusInWork();
      },
      onHint: () => setSession(showHint),
      onClear: () => setSession(clearTiles),
    };
  }, [afterRender]);

  return {
    session,
    answerTry,
    refs: { cardRef, answerRef, workRef, backRowRef, clearRef, mainRef },
    nudge: isNudged ? nudgeTarget : null,
    onAnswer,
    onAnswerChange,
    onPartChange,
    onChoice,
    onNumberChoice,
    onPick,
    onAnswerClick: () => selectRejectedAnswer(session.rejectedAnswer),
    onHelp,
    onBack,
    onReturnToTiles,
    onNext,
    tiles,
  };
}

export type TileLesson = ReturnType<typeof useTileLesson>;
