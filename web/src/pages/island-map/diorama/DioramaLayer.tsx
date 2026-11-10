import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Icon } from "../../../components/Icon";
import { Avatar } from "../../../components/Avatar";
import { usePhoto } from "../../../photo";
import { COPY } from "../../../copy";
import { useText } from "../../../grade";
import type { Subject, SubjectId } from "../../../data";
import type { Game } from "../../../game/use-game";
import type { CreateDiorama, DioramaHandle, IslandAnchor } from "./engine-api";
import { areaOf, type MapArea } from "./layout";

export interface DioramaLayerProps {
  create: CreateDiorama;
  game: Game;
  /** 今の学年で出す島（FR-002）。変わると模型を作り直す */
  subjects: readonly Subject[];
  /** subjects のうち開く島（FR-011）。ほかは鍵の付箋で、押しても入らない */
  openIds: readonly SubjectId[];
  /** 今映している場所。付箋はこの場所の島にだけ出す（D-61） */
  area: MapArea;
  /** アバターが立つ島。島を押すとその島に替わる */
  current: SubjectId;
  /** SCN-01 の間。付箋を消して押せなくする */
  moving: boolean;
  /** MOT-009 の紙を出す */
  paper: boolean;
  handleRef: MutableRefObject<DioramaHandle | null>;
  onReady: () => void;
  onFail: () => void;
  onContextLost: () => void;
  onPress: (id: SubjectId) => void;
  onAreaPress: (area: MapArea) => void;
  onPaperEnd: () => void;
}

function placeAvatar(el: HTMLElement | null, a: IslandAnchor | undefined) {
  if (!el || !a) return;
  el.style.transform = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%) scale(${a.scale})`;
}

export function DioramaLayer(props: DioramaLayerProps) {
  const { create, game, subjects, openIds, area, current, moving, paper, handleRef } = props;
  const t = useText();
  // アバターで選んだポーズとかおを、歩く棒人間へ（そうびは着けている装備）
  const look = usePhoto();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRefs = useRef<Partial<Record<SubjectId, HTMLButtonElement | null>>>({});
  // 場所を移ると付箋が作り直されるので、最後の位置を控えて、作った時に当てる
  const tagPlaces = useRef<Partial<Record<SubjectId, string>>>({});
  const avatarRef = useRef<HTMLSpanElement>(null);
  const anchorOf = useRef<Partial<Record<SubjectId, IslandAnchor>>>({});
  const latest = useRef(props);
  latest.current = props;
  const [anchored, setAnchored] = useState(false);
  const subjectKey = subjects.map((s) => `${s.id}${openIds.includes(s.id) ? "" : "!"}`).join(",");

  useEffect(() => {
    let live = true;
    let handle: DioramaHandle | null = null;
    const onAnchors = (anchors: IslandAnchor[]) => {
      for (const a of anchors) {
        const place = `translate(${a.x}px, ${a.y}px) translate(-50%, -100%)`;
        tagPlaces.current[a.id] = place;
        const tag = tagRefs.current[a.id];
        if (tag) tag.style.transform = place;
        anchorOf.current[a.id] = a;
      }
      placeAvatar(avatarRef.current, anchorOf.current[latest.current.current]);
      setAnchored(true);
    };
    // 作り直す時は前の位置を使わない
    anchorOf.current = {};
    setAnchored(false);
    // StrictMode の二重実行で2回作らないよう、片付けで取り消せる形で遅らせる
    queueMicrotask(() => {
      const canvas = canvasRef.current;
      if (!live || !canvas) return;
      try {
        handle = create({
          canvas,
          islands: latest.current.subjects.map((s) => ({ id: s.id, open: latest.current.openIds.includes(s.id) })),
          startArea: latest.current.area,
          onAnchors,
          onIslandPress: (id) => latest.current.onPress(id),
          onAreaPress: (next) => latest.current.onAreaPress(next),
          onContextLost: () => latest.current.onContextLost(),
        });
      } catch {
        latest.current.onFail();
        return;
      }
      const made = handle;
      // 3D は区切って組み立てる（D-142）。最初の1枚を描き終えるまで onReady を呼ばない
      void (made.ready ?? Promise.resolve()).then(
        () => {
          if (!live) return;
          handleRef.current = made;
          latest.current.onReady();
        },
        () => {
          if (live) latest.current.onFail();
        },
      );
    });
    return () => {
      live = false;
      handleRef.current = null;
      handle?.dispose();
    };
    // コールバックは latest 経由で最新を呼ぶ。学年が変わって島の組が替わったら作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [create, subjectKey]);

  // 立つ島が替わった時と、アバターを作り直した時に位置を当て直す
  useEffect(() => {
    placeAvatar(avatarRef.current, anchorOf.current[current]);
  }, [current, area]);

  const highlight = (id: SubjectId | null) => handleRef.current?.setHighlight(id);
  const focusVisible = (el: HTMLElement) => {
    try {
      return el.matches(":focus-visible");
    } catch {
      return true;
    }
  };

  // 紙はアバターの立つ島（押した島）の位置から広がる
  let origin = "50% 50%";
  if (paper) {
    const a = anchorOf.current[current];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (a && rect) origin = `${rect.left + a.x}px ${rect.top + a.y}px`;
  }

  return (
    <div className="diorama-layer">
      <canvas ref={canvasRef} className="diorama-layer__canvas" aria-hidden="true" />
      {areaOf(current) === area && (
        <span ref={avatarRef} className={`diorama-layer__avatar${moving ? " is-moving" : ""}`} aria-hidden="true">
          <Avatar gear={game.wornGear} size="walker" pose={look?.pose} face={look?.face} />
        </span>
      )}
      <div className={`diorama-layer__tags${anchored ? "" : " is-hidden"}`}>
        {subjects.filter((subject) => areaOf(subject.id) === area).map((subject) => {
          const open = openIds.includes(subject.id);
          const level = game.subjectLevel(subject.id);
          const classes = ["island-tag", open ? "island-tag--open" : "island-tag--locked"];
          if (moving) classes.push("is-moving");
          return (
            <button
              key={subject.id}
              ref={(el) => {
                tagRefs.current[subject.id] = el;
                const place = tagPlaces.current[subject.id];
                if (el && place) el.style.transform = place;
              }}
              type="button"
              className={classes.join(" ")}
              data-subject={subject.id}
              style={{ "--island-color": subject.color } as React.CSSProperties}
              aria-label={t(open ? COPY.CP_006(subject.name, level) : COPY.CP_005(subject.name))}
              aria-disabled={open ? undefined : true}
              onClick={() => props.onPress(subject.id)}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") highlight(subject.id); }}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") highlight(null); }}
              onFocus={(e) => { if (focusVisible(e.currentTarget)) highlight(subject.id); }}
              onBlur={() => highlight(null)}
            >
              {!open && <span className="island-tag__lock"><Icon name="lock" /></span>}
              <span className="island-tag__name" aria-hidden="true">{t(subject.name)}</span>
              {open && <span className="island-tag__level" aria-hidden="true">{COPY.CP_003(level)}</span>}
            </button>
          );
        })}
      </div>
      {paper && (
        <div
          className="island-map__paper"
          style={{ transformOrigin: origin }}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) props.onPaperEnd(); }}
        />
      )}
    </div>
  );
}
