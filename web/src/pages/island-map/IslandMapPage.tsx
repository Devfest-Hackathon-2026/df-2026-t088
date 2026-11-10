import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Avatar } from "../../components/Avatar";
import { usePhoto } from "../../photo";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { playSe } from "../../audio/use-bgm";
import { COPY } from "../../copy";
import { DEFAULT_GRADE, useGrade, useText } from "../../grade";
import { HIGHLAND_SUBJECTS, SUBJECTS, shownSubjectsOf, subjectsOfGrade } from "../../data";
import { useLoading } from "../../loading";
import { holdBackWave } from "../../back-wave/back-wave";
import type { Grade } from "../../data/kanji-grades";
import type { Subject, SubjectId } from "../../data";
import type { Game } from "../../game/use-game";
import { DioramaLayer } from "./diorama/DioramaLayer";
import type { CreateDiorama, DioramaHandle } from "./diorama/engine-api";
import type { MapArea } from "./diorama/layout";
import {
  cachedDiorama,
  hasWebGL2,
  loadDioramaScene,
  reducesMotion,
  tokenMs,
  useDioramaCreate,
} from "./diorama/use-diorama";
import { IslandPaths } from "./IslandPaths";
import "./IslandMapPage.css";

export interface IslandMapPageProps {
  game: Game;
  /** 島を選んだ後に呼ぶ。算数は章をえらぶ（/sansu、PG-004）、ほかは教科の島（PG-005）へ移る（D-91） */
  onEnter: (id: SubjectId) => void;
  /** 最初に映す場所。高原の島から「教科をえらぶ」で戻った時は高原（D-91）。無ければ海 */
  startArea?: MapArea;
  /** アバターが最初に立つ島。戻る前にいた教科の島。無いか、今の学年に無ければ算数 */
  startSubject?: SubjectId;
  /** 3D の読み込み口。テストで偽物を渡す。渡すと WebGL の有無は見ない */
  loadDiorama?: () => Promise<CreateDiorama | null>;
  /** 「教科をえらぶ」の波で開いた時。波が覆ったまま待つので CMP-012 は出さない（D-141）。最初の描画の値を使う */
  viaWave?: boolean;
  /** 上の帯の左に置く入口（D-250。「出すもの」とカメラ）。地図は /home なので、出す物は App が決める。無ければ帯は空 */
  bar?: ReactNode;
}

const FALLBACK_HOP_MS = 310;
// 波で待つ間に3Dを作り終える上限（D-141）。back-wave の12秒の安全解放より前
const WAVE_WAIT_MS = 10_000;

/** 今の学年で出す島（FR-001、FR-002）。その学年に実施される教科すべて。開くのは shownSubjectsOf だけで、ほかは鍵（FR-011） */
function subjectsShown(grade: Grade): Subject[] {
  const ids = subjectsOfGrade(grade);
  return SUBJECTS.filter((subject) => ids.includes(subject.id));
}

// 跳ねる長さは CSS のトークンと同じ値を使う
const hopMs = (): number => tokenMs("--duration-hop", FALLBACK_HOP_MS);

function IslandButton({ subject, open, game, hopping, onSelect }: {
  subject: Subject;
  /** 開く島か。鍵の島は押せるが、入らずトーストを出す（FR-011） */
  open: boolean;
  game: Game;
  hopping: boolean;
  onSelect: (subject: Subject) => void;
}) {
  const t = useText();
  // アバターで選んだポーズとかおを、島の上の棒人間へ（そうびは着けている装備）
  const look = usePhoto();
  const classes = ["island",`island--${subject.id}`, open ? "island--open" : "island--locked"];
  if (hopping && open) classes.push("is-hopping");
  const level = game.subjectLevel(subject.id);
  return (
    <button
      type="button"
      className={classes.join(" ")}
      data-subject={subject.id}
      style={{ "--island-color": subject.color } as React.CSSProperties}
      aria-label={t(open ? COPY.CP_006(subject.name, level) : COPY.CP_005(subject.name))}
      aria-disabled={open ? undefined : true}
      onClick={() => onSelect(subject)}
    >
      {open && (
        <span className="island__avatar"><Avatar gear={game.wornGear} size="walker" pose={look?.pose} face={look?.face} /></span>
      )}
      {!open && <span className="island__lock"><Icon name="lock" /></span>}
      <span className="island__name" aria-hidden="true">{t(subject.name)}</span>
      {open && <span className="island__level" aria-hidden="true">{COPY.CP_003(level)}</span>}
    </button>
  );
}

/** 「高原へ行く →」「← 海へもどる」の矢印。行き先の向き。飾りなので読み上げない（D-150） */
function GateArrow({ dir }: { dir: "left" | "right" }) {
  const d = dir === "right" ? "M5 12h13M13 6l6 6-6 6" : "M19 12H6M11 6l-6 6 6 6";
  return (
    <svg className="island-map__gate-arrow" viewBox="0 0 24 24" aria-hidden="true" width="1em" height="1em">
      <path fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function IslandMapPage({ game, onEnter, startArea = "sea", startSubject = "sansu", loadDiorama, viaWave: viaWaveProp = false, bar }: IslandMapPageProps) {
  const t = useText();
  const grade = useGrade() ?? DEFAULT_GRADE;
  const shown = subjectsShown(grade);
  const openIds = shownSubjectsOf(grade);
  const seaShown = shown.filter((subject) => !HIGHLAND_SUBJECTS.includes(subject.id));
  const landShown = shown.filter((subject) => HIGHLAND_SUBJECTS.includes(subject.id));
  // 波で開いたかも、開いた時に一度だけ決める
  const [viaWave] = useState(viaWaveProp);
  // 3D を使えるかは、開いた時に一度だけ決める
  const [env] = useState(() => {
    const enabled = !reducesMotion() && (loadDiorama ? true : hasWebGL2());
    const cached = enabled && !loadDiorama ? cachedDiorama() : null;
    return { enabled, cached };
  });
  const handleRef = useRef<DioramaHandle | null>(null);
  const dioramaOn = useRef(false);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const aliveRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enterRef = useRef(onEnter);
  const enteringRef = useRef<SubjectId>("sansu");
  enterRef.current = onEnter;

  const [hopping, setHopping] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [paper, setPaper] = useState(false);
  // 高原の島から戻った時は、高原の全景から始める
  // 高原に出す島が無い学年は、高原へ移らない
  const hasHighland = landShown.length > 0;
  const [chosenArea, setArea] = useState<MapArea>(startArea);
  const area: MapArea = hasHighland ? chosenArea : "sea";
  // アバターが立つ島。押した島へ移る
  const [chosen, setCurrent] = useState<SubjectId>(startSubject);
  // 立っていた島が今の学年に無い時は、算数の島に立たせる
  const current: SubjectId = openIds.includes(chosen) ? chosen : "sansu";

  const { create, failed: loadFailed } = useDioramaCreate({
    enabled: env.enabled,
    load: loadDiorama ?? loadDioramaScene,
    initial: null,
  });
  const layerOn = create !== null && !failed;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  // onEnter は必ず1回、unmount 後には呼ばない
  const finish = useCallback(() => {
    if (doneRef.current || !aliveRef.current) return;
    doneRef.current = true;
    clearTimeout(timer.current);
    // 島へ入ると決まった時の音（D-101）。押した時の音（tap）とは別に鳴らす
    playSe("enter");
    enterRef.current(enteringRef.current);
  }, []);

  const onReady = () => {
    dioramaOn.current = true;
    setReady(true);
  };
  const toFlat = () => {
    dioramaOn.current = false;
    setReady(false);
    setFailed(true);
    setMoving(false);
    setPaper(false);
  };

  const press = (id: SubjectId) => {
    if (busyRef.current) return;
    const subject = shown.find((s) => s.id === id);
    if (!subject) return;
    const handle = dioramaOn.current ? handleRef.current : null;
    // 鍵の島（FR-011）は入らない。音とトーストで知らせ、3D なら島をのぞく。アバターは動かさない
    if (!openIds.includes(id)) {
      playSe("locked");
      game.showToast(COPY.CP_004(subject.name));
      handle?.peek(id);
      return;
    }
    // 開く島は算数なら「選んだ」印が立つ
    game.selectSubject(id);
    playSe("tap");
    enteringRef.current = id;
    setCurrent(id);
    busyRef.current = true;
    if (!handle) {
      if (reducesMotion()) {
        finish();
        return;
      }
      setHopping(true);
      timer.current = setTimeout(finish, hopMs());
      return;
    }
    setMoving(true);
    const arrived = () => {
      if (!aliveRef.current) return;
      // 動きの途中で WebGL を失った時は、紙を出さずそのまま進む
      if (!dioramaOn.current) {
        finish();
        return;
      }
      setPaper(true);
      timer.current = setTimeout(finish, tokenMs("--duration-paper", 240) + 100);
    };
    handle.zoomTo(id).then(arrived, arrived);
  };

  const moveTo = (next: MapArea) => {
    if (busyRef.current || next === area || (next === "highland" && !hasHighland)) return;
    setArea(next);
    const handle = dioramaOn.current ? handleRef.current : null;
    if (!handle) return;
    busyRef.current = true;
    handle.setHighlight(null);
    setMoving(true);
    const arrived = () => {
      if (!aliveRef.current) return;
      busyRef.current = false;
      setMoving(false);
    };
    handle.showArea(next).then(arrived, arrived);
  };

  // 平面の地図は 3D が使えないと決まった時だけ出す。読み込み中は見出しと CMP-012 だけにする
  const showFlat = !env.enabled || loadFailed || failed;
  // 3D の準備ができるまで CMP-012 を出し続ける（D-42、D-43）。読み込み済みなら待つ物が無いので出さない（D-52）
  const waiting = env.enabled && env.cached === null && !showFlat && !(layerOn && ready);
  useLoading(waiting && !viaWave);
  // 波で来た時は、読み込み済みでも3Dを作り終えるまで波を覆ったままにする（D-141）
  const holdWave = viaWave && env.enabled && !showFlat && !(layerOn && ready);
  // 波を待たせる理由を持つ間だけ保持する。layout effect なので flushSync の中でも波が覆った直後に決まる。
  // StrictMode の hold → 解放 → hold でも、正味1つが残る
  useLayoutEffect(() => {
    if (!holdWave) return;
    return holdBackWave();
  }, [holdWave]);
  // 読み込みの10秒（use-diorama）とは別に、作る時間も含めて10秒で平面にする
  useEffect(() => {
    if (!holdWave) return;
    const id = setTimeout(toFlat, WAVE_WAIT_MS);
    return () => clearTimeout(id);
    // toFlat は state の更新だけで毎回作り直されるが、中身は変わらない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdWave]);
  const classes = ["island-map"];
  if (layerOn && ready) classes.push("island-map--diorama");
  return (
    <main className={classes.join(" ")} aria-label={t(COPY.CP_738)}>
      {layerOn && (
        <DioramaLayer
          create={create}
          game={game}
          subjects={shown}
          openIds={openIds}
          area={area}
          current={current}
          moving={moving}
          paper={paper}
          handleRef={handleRef}
          onReady={onReady}
          onFail={toFlat}
          onContextLost={toFlat}
          onPress={press}
          onAreaPress={moveTo}
          onPaperEnd={finish}
        />
      )}
      {/* 上の帯（D-149、D-250）。3D の準備を待たずに出す（状態の表の「読み込み中」）。左に App から渡す入口（「出すもの」とカメラ）。
          音と顔は右上の CMP-043（D-245）なので、帯は右に --corner-reserve を空ける */}
      <div className="island-map__bar">{bar}</div>
      {showFlat && area === "sea" && (
        <div className="island-map__field">
          <IslandPaths subjects={seaShown.map((subject) => subject.id)} />
          {seaShown.map((subject) => (
            <IslandButton key={subject.id} subject={subject} open={openIds.includes(subject.id)} game={game} hopping={hopping} onSelect={(s) => press(s.id)} />
          ))}
        </div>
      )}
      {showFlat && area === "highland" && (
        <div className="island-map__highland">
          {landShown.map((subject) => (
            <IslandButton key={subject.id} subject={subject} open={openIds.includes(subject.id)} game={game} hopping={hopping} onSelect={(s) => press(s.id)} />
          ))}
        </div>
      )}
      {hasHighland && (showFlat || (layerOn && ready)) && (
        <Button
          className={`island-map__gate island-map__gate--${area}${moving ? " is-moving" : ""}`}
          onClick={() => moveTo(area === "sea" ? "highland" : "sea")}
        >
          {area === "highland" && <GateArrow dir="left" />}
          <span>{t(area === "sea" ? COPY.CP_008 : COPY.CP_009)}</span>
          {area === "sea" && <GateArrow dir="right" />}
        </Button>
      )}
    </main>
  );
}
