import { Button } from "../../components/Button";
import { COPY } from "../../copy";
import { useText } from "../../grade";

interface TopBarProps {
  /** 島の地図（/home）へ移る */
  onOpenMap: () => void;
}

// SEC-004-01。教科をえらぶ、見出し。音と顔は右上の CMP-043（D-245）に移したので、帯の右に --corner-reserve を空ける。ここだけ紙の色で塗り、下に線を引く
export function TopBar({ onOpenMap }: TopBarProps) {
  const t = useText();
  return (
    <header className="cm-bar">
      <Button variant="secondary" className="cm-bar__map" se={null} onClick={onOpenMap}>{t(COPY.CP_215)}</Button>
      <h1 className="cm-bar__title">{t(COPY.CP_280)}</h1>
    </header>
  );
}
