import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { playSe } from "../../audio/use-bgm";
import { Icon } from "../../components/Icon";
import { Ruby } from "../../components/Ruby";
import { COPY } from "../../copy";
import { DOMAINS } from "../../data";
import type { Chapter } from "../../data";
import { parseDurationMs } from "../../game/logic";
import type { Game } from "../../game/use-game";
import { useText } from "../../grade";
import { Walker } from "../board/Walker";
import { roadRows, roadSpot, useColumns } from "./layout";
import type { RoadSpot } from "./layout";
import { TopBar } from "./TopBar";
import "./chapter-map.css";

export interface ChapterMapPageProps {
  game: Game;
  /** 島の地図（/home）へ移る */
  onOpenMap: () => void;
}

interface Point { x: number; y: number }

/** 道を描くために測る値。道は札の位置から計算せず、CSS で置いた印の位置を測る */
interface RoadMetrics { width: number; rowHeight: number; startX: number; goalX: number }

const FALLBACK_PAPER_MS = 240;
const domainName = (chapter: Chapter) => DOMAINS.find((domain) => domain.id === chapter.domain)?.name ?? "";
const reducesMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// 行の高さと、スタートとゴールの中心を、章の地図の左上からの位置で測る。幅やフォントで変わるので、計算で出さない
function useRoadMetrics(columns: number, rows: number) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<RoadMetrics | null>(null);
  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const centerX = (selector: string, box: DOMRect) => {
      const rect = map.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      return rect ? rect.left - box.left + rect.width / 2 : 0;
    };
    const measure = () => {
      const box = map.getBoundingClientRect();
      setMetrics({
        width: box.width,
        rowHeight: box.height / rows,
        startX: centerX("[data-road-start]", box),
        goalX: centerX("[data-road-goal]", box),
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(map);
    return () => observer.disconnect();
  }, [columns, rows]);
  return { mapRef, metrics };
}

// CMP-007。スタートからゴールまで1本の道。行の端は半円で折り返す。分野の色は塗らない（D-109）
function Road({ metrics, rows }: { metrics: RoadMetrics | null; rows: number }) {
  if (!metrics || metrics.rowHeight <= 0) return <svg className="cm-road" aria-hidden="true" />;
  const { width, rowHeight, startX, goalX } = metrics;
  const radius = rowHeight / 2;
  // 左端は最初の印、右端は左右対称の位置
  const left = startX;
  const right = width - startX;
  let d = `M${left} ${radius}`;
  for (let row = 0; row < rows; row++) {
    const y = row * rowHeight + radius;
    const goesRight = row % 2 === 0;
    if (row === rows - 1) {
      d += ` L${goalX} ${y}`;
      break;
    }
    const end = goesRight ? right : left;
    d += ` L${end} ${y} A${radius} ${radius} 0 0 ${goesRight ? 1 : 0} ${end} ${y + rowHeight}`;
  }
  return (
    <svg className="cm-road" aria-hidden="true">
      <path d={d} className="cm-road__edge" />
      <path d={d} className="cm-road__fill" />
      <path d={d} className="cm-road__dash" />
    </svg>
  );
}

// 札や旗を道の上へ置く。位置は CSS が行と割合から出す
const spotStyle = (spot: RoadSpot): CSSProperties => ({ "--row": spot.row, "--fx": spot.fx }) as CSSProperties;

// 札は道の順に -1.5°、0°、+1.5° と傾ける（D-109）
const tiltOf = (order: number): string => `${((order % 3) - 1) * 1.5}deg`;

interface CardProps {
  game: Game;
  chapter: Chapter;
  /** 道の順の番号（1始まり） */
  order: number;
  isNow: boolean;
  onPress: (chapter: Chapter, element: HTMLElement) => void;
}

// CMP-017。状態は 今の章、クリア済み、鍵、開いている の順に決める
function Card({ game, chapter, order, isNow, onPress }: CardProps) {
  const t = useText();
  const open = game.isChapterOpen(chapter);
  const progress = game.progressOf(chapter);
  const cleared = progress.test;
  const locked = !open;
  const domain = domainName(chapter);
  const label = t(locked ? COPY.CP_207(chapter.title) : cleared ? COPY.CP_282(chapter.title, domain) : COPY.CP_281(chapter.title, domain));
  const classes = ["cm-card", `cm-card--${chapter.domain}`, isNow && "is-now", cleared && "is-done", locked && "is-locked"];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(" ")}
      data-chapter-card={chapter.id}
      aria-label={label}
      aria-current={isNow ? "page" : undefined}
      disabled={locked}
      style={{ "--tilt": tiltOf(order) } as CSSProperties}
      onClick={(event) => onPress(chapter, event.currentTarget)}
    >
      {isNow && <span className="cm-card__anchor" data-walker-anchor aria-hidden="true" />}
      <span className="cm-card__badge" aria-hidden="true">{order}</span>
      <span className="cm-card__name" aria-hidden="true">
        {cleared && <span className="cm-card__check"><Icon name="check" /></span>}
        {locked && <span className="cm-card__lock"><Icon name="lock" /></span>}
        <Ruby text={chapter.title} />
      </span>
      {isNow && <span className="cm-card__progress" aria-hidden="true">{t(COPY.CP_214(progress.done, chapter.items.length))}</span>}
    </button>
  );
}

export function ChapterMapPage({ game, onOpenMap }: ChapterMapPageProps) {
  const t = useText();
  const columns = useColumns();
  // 今の学年の算数の章（4年は16章）。行の数で道を伸ばす
  const spotCount = game.chapters.length + 2;
  const rows = roadRows(spotCount, columns);
  const { mapRef, metrics } = useRoadMetrics(columns, rows);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [paper, setPaper] = useState<Point | null>(null);
  const nowId = game.chapter.id;

  // 開いた時の1回だけ、今の章の札へ focus を置き、見える位置までスクロールする（ページごと縦に動く）
  useEffect(() => {
    const card = mapRef.current?.querySelector<HTMLElement>(`[data-chapter-card="${nowId}"]`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView?.({ block: "nearest" });
  }, [mapRef]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // MOT-023：盤面の紙が押した札の位置から広がってから、章を開く
  const press = (chapter: Chapter, element: HTMLElement) => {
    if (paper) return;
    // 鍵の章は鍵の島と同じ音、開いた章は決定の音（D-104）
    if (!game.isChapterOpen(chapter)) {
      playSe("locked");
      return;
    }
    playSe("enter");
    if (reducesMotion()) {
      game.openChapter(chapter.id);
      return;
    }
    const rect = element.getBoundingClientRect();
    setPaper({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--duration-paper");
    timer.current = setTimeout(() => game.openChapter(chapter.id), parseDurationMs(raw, FALLBACK_PAPER_MS) + 100);
  };

  return (
    <div className="cm-page">
      <TopBar onOpenMap={onOpenMap} />
      <main className="cm-body">
        <ul className="cm-legend">
          {DOMAINS.map((domain) => (
            <li key={domain.id}>
              <i className={`cm-legend__swatch cm-legend__swatch--${domain.id}`} aria-hidden="true" />
              {t(domain.name)}
            </li>
          ))}
        </ul>
        <div className="cm-map" ref={mapRef} style={{ "--rows": rows, "--columns": columns } as CSSProperties}>
          <Road metrics={metrics} rows={rows} />
          <div className="cm-flag" data-road-start style={spotStyle(roadSpot(0, columns))}>{t(COPY.CP_283)}</div>
          <ol className="cm-list" aria-label={t(COPY.CP_246)}>
            {game.chapters.map((chapter, index) => (
              <li key={chapter.id} className="cm-item" style={spotStyle(roadSpot(index + 1, columns))}>
                <Card game={game} chapter={chapter} order={index + 1} isNow={chapter.id === nowId} onPress={press} />
              </li>
            ))}
          </ol>
          <div className="cm-flag cm-flag--goal" data-road-goal style={spotStyle(roadSpot(spotCount - 1, columns))}>
            <span className="cm-flag__star"><Icon name="star" /></span>
            {t(COPY.CP_285)}
          </div>
          <Walker anchorKey={`${nowId}:${columns}`} gear={game.wornGear} walking={false} className="cm-walker" />
        </div>
      </main>
      {paper && (
        <div className="cm-paper" style={{ transformOrigin: `${paper.x}px ${paper.y}px` }} aria-hidden="true" />
      )}
    </div>
  );
}
