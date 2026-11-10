import { useEffect, useRef, useState, type CSSProperties } from "react";
import { playSe, useBgmMuted, useBgmVolume } from "../audio/use-bgm";
import { COPY } from "../copy";
import { useText } from "../grade";
import "./SoundButton.css";

const PEN = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// CMP-016。手描きのスピーカー。消してある時は斜めの線を足す
function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path {...PEN} d="M5 12h5l7-6v20l-7-6H5z" />
      {muted
        ? <path {...PEN} d="M4 4l24 24" />
        : <path {...PEN} d="M21 11c2 3 2 7 0 10M25 7c4 5 4 13 0 18" />}
    </svg>
  );
}

const FINE_QUERY = "(hover: hover) and (pointer: fine)";
// matchMedia が無い環境（テストなど）はマウスとして扱う
const isFine = () => typeof matchMedia !== "function" || matchMedia(FINE_QUERY).matches;

// マウスの端末かどうか。マウスは乗せると開き、タッチ等は押して開く（D-241）
function useFinePointer() {
  const [fine, setFine] = useState(isFine);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const list = matchMedia(FINE_QUERY);
    const update = () => setFine(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return fine;
}

// マウスが札から外れてから閉じるまで（04_components.md の表）
const HOVER_CLOSE_MS = 400;

/** CMP-016 音のボタン。ふだんはスピーカーの丸いボタンだけで、開くと札（消す・出すボタンと大きさのバー）が丸から伸びる（D-241、MOT-031）。
 *  grow は伸びる向き。左上に置く画面（PG-009）は right。right-wide は 768px 以上だけ右で、767px 以下は左（PG-006）。bar は上の帯の 44px（D-149）。
 *  開く・閉じるは入力ごとに分ける。マウスは乗せると開き外れて 400ms で閉じる。キーボードはフォーカスで動かさずに開き、外れるか Esc で閉じる。
 *  タッチ等は閉じている丸を押した1回は開くだけで、札の外を押すか Esc で閉じる */
export function SoundButton({ className, bar = false, grow = "left" }: { className?: string; bar?: boolean; grow?: "left" | "right" | "right-wide" }) {
  const t = useText();
  const [muted, setMuted] = useBgmMuted();
  const [volume, setVolume] = useBgmVolume();
  const fine = useFinePointer();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 直前の操作がポインタか。ポインタで入ったフォーカスでは開かない（開くのは乗せる・押す側で決める）
  const viaPointer = useRef(false);
  // Esc でスピーカーへフォーカスを戻した時に、そのフォーカスで開き直さない
  const skipFocusOpen = useRef(false);
  const open = hovered || focused || tapped;
  // キーボードのフォーカスだけで開いた時は動かさない（MOT-031）
  const instant = focused && !hovered && !tapped;
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearTimeout(closeTimer.current);
      setHovered(false);
      setFocused(false);
      setTapped(false);
      skipFocusOpen.current = true;
      speakerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setTapped(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);
  const rootClasses = ["sound-control", bar && "sound-control--bar", className].filter(Boolean).join(" ");
  // 消してある時は 0 に見せる。左いっぱいまで動かすと消す（D-203）
  const shown = muted ? 0 : Math.round(volume * 100);
  // タッチ等で閉じている時だけ「音のせってい」と読む（CP-1266）
  const touchClosed = !fine && !open;
  return (
    <div
      ref={rootRef}
      className={rootClasses}
      data-open={open}
      data-grow={grow}
      data-instant={instant}
      data-muted={muted}
      onPointerEnter={() => {
        if (!fine) return;
        clearTimeout(closeTimer.current);
        setHovered(true);
      }}
      onPointerLeave={() => {
        if (!fine) return;
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setHovered(false), HOVER_CLOSE_MS);
      }}
      onPointerDownCapture={() => { viaPointer.current = true; }}
      onKeyDownCapture={() => { viaPointer.current = false; }}
      onFocusCapture={() => {
        if (skipFocusOpen.current) {
          skipFocusOpen.current = false;
          return;
        }
        if (!viaPointer.current) setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (rootRef.current?.contains(event.relatedTarget as Node | null)) return;
        viaPointer.current = false;
        setFocused(false);
      }}
    >
      <span className="sound-control__skin" aria-hidden="true" />
      <button
        ref={speakerRef}
        type="button"
        className={["sound-button", bar && "sound-button--bar"].filter(Boolean).join(" ")}
        data-muted={muted}
        aria-label={t(touchClosed ? COPY.CP_1266 : muted ? COPY.CP_911 : COPY.CP_910)}
        aria-expanded={fine ? undefined : open}
        onClick={() => {
          // タッチ等の閉じている丸は、この1回は開くだけ（D-241）
          if (touchClosed) {
            setTapped(true);
            return;
          }
          setMuted(!muted);
          // 鳴らし直した時は、音が戻ったことを選ぶ音で知らせる（D-104）。消した時は鳴らない
          playSe("select");
        }}
      >
        <Speaker muted={muted} />
      </button>
      {/* 大きさのバー（D-203）。動かした音そのものが手応えなので、効果音は鳴らさない。0 は消すと同じ。閉じている間は inert でフォーカスも押下も届かない */}
      <input
        type="range"
        className="sound-control__range"
        min={0}
        max={100}
        step={5}
        value={shown}
        aria-label={t(COPY.CP_1156)}
        data-empty={shown === 0}
        inert={!open}
        style={{ "--sound-level": shown / 100 } as CSSProperties}
        onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)}
      />
    </div>
  );
}
