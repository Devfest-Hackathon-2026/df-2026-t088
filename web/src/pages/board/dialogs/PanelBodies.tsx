import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { COPY } from "../../../copy";
import { useText } from "../../../grade";
import type { Game, LevelUpInfo } from "../../../game/use-game";

interface ResetBodyProps {
  onClose: () => void;
  onReset: () => void;
}

// dialog が開く前の focus() は効かないので、開いた後に「やめる」へ置く。
// 部品の外に置いて ref を変えない。描画のたびに作ると、そのたびにフォーカスが戻る
function focusCancel(stack: HTMLDivElement | null) {
  const cancel = stack?.querySelector("button");
  if (cancel) queueMicrotask(() => cancel.focus());
}

// 「やめる」を先に置いて primary にし、最初のフォーカスもそこへ置く。消す操作を赤で強調しない（CMP-008）
export function ResetBody({ onClose, onReset }: ResetBodyProps) {
  const t = useText();
  return (
    <>
      <h2 id="reset-title" className="panel-title">{COPY.CP_240}</h2>
      <p className="panel-note">{t(COPY.CP_241)}</p>
      <div className="panel-stack" ref={focusCancel}>
        <Button variant="primary" autoFocus onClick={onClose}>{COPY.CP_243}</Button>
        <Button variant="secondary" se="enter" onClick={onReset}>{COPY.CP_242}</Button>
      </div>
    </>
  );
}

export function IntroBody({ level, onClose }: { level: number; onClose: () => void }) {
  const t = useText();
  return (
    <>
      <h2 id="intro-title" className="panel-title">{t(COPY.CP_251)}</h2>
      <p className="panel-learn">{t(COPY.CP_252(level))}</p>
      <p className="panel-learn">{t(COPY.CP_253)}</p>
      <Button variant="primary" className="panel-wide" se="enter" onClick={onClose}>{COPY.CP_254}</Button>
    </>
  );
}

export function LevelUpBody({ game, info, onClose }: { game: Game; info: LevelUpInfo; onClose: () => void }) {
  const t = useText();
  return (
    <>
      <div className="levelup-avatar"><Avatar gear={game.wornGear} size="levelup" /></div>
      <h2 id="levelup-title" className="panel-title">{COPY.CP_235(info.level)}</h2>
      {info.newGear && <p className="panel-learn">{t(COPY.CP_236(info.newGear.name))}</p>}
      <Button variant="primary" className="panel-wide" se="enter" onClick={onClose}>{COPY.CP_237}</Button>
    </>
  );
}
