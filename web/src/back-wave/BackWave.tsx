import { useEffect, useRef, useSyncExternalStore } from "react";
import { activeKind, subscribeActive, subscribeFrame, waveClip } from "./back-wave";
import "./BackWave.css";

const WAVES = ["shallow", "mid", "deep"];

/**
 * MOT-024 と MOT-032 の重ね。動いている間だけ出て、入力を止める。読み上げの対象にしない（D-103、D-251）。
 * MOT-032 の濃さは CSS の transition（--duration-normal、--ease-out）に任せ、ここでは出す・消すだけを切り替える
 */
export function BackWave() {
  const kind = useSyncExternalStore(subscribeActive, activeKind);
  const waves = useRef<(HTMLDivElement | null)[]>([]);
  const fade = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeFrame((p, lap) => {
    if (fade.current) {
      fade.current.classList.toggle("back-fade--shown", p < 0.5);
      return;
    }
    waves.current.forEach((el, i) => {
      if (!el) return;
      // 下の3枚は引く側の動き、上の3枚は待つ間の打ち寄せ。打ち寄せていない時は CSS の画面外に戻す
      const level = i < WAVES.length ? p : lap;
      el.style.clipPath = level === null ? "" : waveClip(i % WAVES.length, level, window.innerWidth, window.innerHeight);
    });
  }), []);

  if (kind === null) return null;
  if (kind === "fade") return <div ref={fade} className="back-fade" aria-hidden="true" />;
  return (
    <div className="back-wave" aria-hidden="true">
      {[...WAVES, ...WAVES].map((depth, i) => (
        <div key={i} ref={(el) => { waves.current[i] = el; }} className={`back-wave__wave back-wave__wave--${depth}`} />
      ))}
    </div>
  );
}
