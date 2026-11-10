// CMP-028 アカウントのパネル（D-148、D-194）。どの画面の顔のボタンからも右に開く。外枠・Esc・覆い・フォーカスの戻りは Panel（account）。
// 上のまとまり（写真・名前・Lv・メーター・×）はいつも見え、タブ「くわしく」「アバター」で中身を替える
import { useEffect, useState } from "react";
import { AvatarPhoto } from "../../components/AvatarPhoto";
import { Meter } from "../../components/Meter";
import { Panel } from "../../components/Panel";
import { COPY } from "../../copy";
import type { Game } from "../../game/use-game";
import { useText } from "../../grade";
import { currentAccount } from "../../login";
import { DEFAULT_LOOK, usePhoto } from "../../photo";
import "../board/dialogs/dialogs.css";
import { AvatarTab } from "./account/AvatarTab";
import { DetailTab } from "./account/DetailTab";
import { TabList } from "./account/TabList";
import "./account.css";

interface AccountPanelProps {
  open: boolean;
  onClose: () => void;
  game: Game;
  showToast: (text: string) => void;
}

type Tab = "detail" | "avatar";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "detail", label: COPY.CP_1131 },
  { id: "avatar", label: COPY.CP_1132 },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

// 開いている間だけ描く（Panel が閉じると捨てる）ので、開くたびに「くわしく」・そうび・ふだんの形に戻り、下書きも消える（D-201）
function AccountBody({ game, showToast, onClose }: Omit<AccountPanelProps, "open">) {
  const t = useText();
  const [tab, setTab] = useState<Tab>("detail");
  const photo = usePhoto();
  const account = currentAccount();
  // まだ撮っていない時は、決まりの選び方に、着けている装備をその場で重ねる
  const look = photo ?? { ...DEFAULT_LOOK, gear: game.wornGear };
  return (
    <>
      <h2 id="account-title" className="visually-hidden">{t(COPY.CP_794)}</h2>
      <header className="account-top">
        <div className="account-top__photo"><AvatarPhoto look={look} shape="top" stampSubject={game.subjectId} /></div>
        <div className="account-top__text">
          <p className="account-top__name">{account?.name ?? ""}</p>
          <p className="account-top__level">{COPY.CP_255(game.level)}</p>
          <Meter ratio={game.levelRatio} label={COPY.CP_204(game.xpToNextLevel)} />
        </div>
        <button id="account-close" type="button" className="account-close" aria-label={t(COPY.CP_234)} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <TabList tabs={TABS} value={tab} onChange={setTab} idPrefix="account-main" panelIdOf={(id) => `account-main-panel-${id}`} />
      <div className="account-content">
        <div id="account-main-panel-detail" role="tabpanel" aria-labelledby="account-main-tab-detail" className="account-tabpanel" hidden={tab !== "detail"}>
          <DetailTab game={game} showToast={showToast} active={tab === "detail"} />
        </div>
        <div id="account-main-panel-avatar" role="tabpanel" aria-labelledby="account-main-tab-avatar" className="account-tabpanel" hidden={tab !== "avatar"}>
          <AvatarTab game={game} showToast={showToast} />
        </div>
      </div>
    </>
  );
}

export function AccountPanel({ open, onClose, game, showToast }: AccountPanelProps) {
  // 開いた時の最初のフォーカスは「とじる」。Panel が showModal した後（親の effect）に置く
  useEffect(() => {
    if (open) document.getElementById("account-close")?.focus();
  }, [open]);
  return (
    <Panel open={open} onClose={onClose} labelledBy="account-title" variant="account">
      <AccountBody game={game} showToast={showToast} onClose={onClose} />
    </Panel>
  );
}
