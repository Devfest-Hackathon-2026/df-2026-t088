import { Panel } from "../../../components/Panel";
import type { Game } from "../../../game/use-game";
import { IntroBody, LevelUpBody } from "./PanelBodies";
import type { BoardDialog } from "./types";
import "./dialogs.css";

export interface BoardDialogsProps {
  game: Game;
  dialog: BoardDialog | null;
  onClose: () => void;
}

// 最初の説明、レベルアップのパネル（SEC-002-06）。
// レベルアップは game.levelUp が null でない時に開き、閉じる時に game.clearLevelUp を呼ぶ
export function BoardDialogs({ game, dialog, onClose }: BoardDialogsProps) {
  const { levelUp } = game;
  return (
    <>
      <Panel open={dialog?.type === "intro"} onClose={onClose} labelledBy="intro-title">
        {dialog?.type === "intro" && <IntroBody level={game.subjectLevel("sansu")} onClose={onClose} />}
      </Panel>
      <Panel open={levelUp !== null} onClose={game.clearLevelUp} labelledBy="levelup-title" variant="levelup">
        {levelUp && <LevelUpBody game={game} info={levelUp} onClose={game.clearLevelUp} />}
      </Panel>
    </>
  );
}
