import { playSe } from "../audio/use-bgm";
import { COPY } from "../copy";
import { useText } from "../grade";
import { AvatarFace } from "./Avatar";
import { SoundButton } from "./SoundButton";
import "./CornerControls.css";

/** CMP-043 右上の音と顔。App に1組だけ置き、子どもの全画面で同じ座標に出す（D-245）。
 *  左から 音（CMP-016）・顔（CMP-015）。音の札は左へ伸びる（D-241）。
 *  onOpenAccount が無い時（ログインしていない画面、PG-009 とログイン前の共有の説明）は音だけで、顔の場所は空けて音の座標を変えない（D-246） */
export function CornerControls({ onOpenAccount }: { onOpenAccount?: () => void }) {
  const t = useText();
  return (
    <div className="corner" data-testid="corner-controls">
      <SoundButton bar grow="left" />
      {onOpenAccount
        ? (
          <button type="button" className="corner__face" aria-label={t(COPY.CP_793)} onClick={() => { playSe("select"); onOpenAccount(); }}>
            <AvatarFace />
          </button>
        )
        : <span className="corner__face-space" aria-hidden="true" />}
    </div>
  );
}
