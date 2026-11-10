import { useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "../../components/Avatar";
import type { GearId } from "../../data";

interface WalkerProps {
  /** 立つ行が替わったら測り直すための印 */
  anchorKey: string;
  gear: GearId[];
  /** 歩いている間だけ、動きと跳ねを付ける。それ以外は置き直すだけで動かさない */
  walking: boolean;
  /** PG-004 など、置き場ごとの見た目を足す */
  className?: string;
}

// 位置は DOM を測って決める。マスの位置はふりがなや折り返し、幅ごとの並びで変わるので、計算で出さない。
// 置き場の親（盤面の枠や章の地図の要素）の中で、印の付いた要素の中心を x と y で返す。
// CSS は .walker を親の左上（left: 0; top: 0）に置き、.walker-anchor で中心から足元への寄せを決める
export function Walker({ anchorKey, gear, walking, className }: WalkerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    // 親の ref は子の effect より後に付くので、自分の要素から親をたどる
    const road = ref.current?.parentElement;
    if (!road) return undefined;
    const measure = () => {
      const anchor = road.querySelector<HTMLElement>("[data-walker-anchor]");
      if (!anchor) return;
      const box = road.getBoundingClientRect();
      const rect = anchor.getBoundingClientRect();
      // 親が中だけスクロールする時も、親の中の位置にする
      setPos({
        x: rect.left - box.left + road.scrollLeft + rect.width / 2,
        y: rect.top - box.top + road.scrollTop + rect.height / 2,
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    // 幅が変わって1行の数が変わった時や、フォントが届いて行の高さが変わった時に測り直す
    const observer = new ResizeObserver(measure);
    observer.observe(road);
    return () => observer.disconnect();
  }, [anchorKey]);

  return (
    <div
      ref={ref}
      className={`walker${walking ? " is-walking" : ""}${className ? ` ${className}` : ""}`}
      style={{ transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)`, visibility: pos === null ? "hidden" : undefined }}
      aria-hidden="true"
    >
      <div className="walker-anchor">
        <Avatar gear={gear} size="walker" />
      </div>
    </div>
  );
}
