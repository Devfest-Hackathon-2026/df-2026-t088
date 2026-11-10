import { COPY } from "../copy";
import { useText } from "../grade";
import { Button } from "./Button";

const PEN = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * 上の帯の左の「← ホーム」（CP-784、CMP-001 quiet、D-149）。読み上げは CP-760。
 * PG-007、PG-008、PG-010 などに置き、押すと /home（PG-001 島の地図。D-250）へ戻る。戻る音は playBackWave が鳴らすので、選ぶ音は鳴らさない（D-104）
 */
export function HomeBackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const t = useText();
  const classes = ["home-back", className].filter(Boolean).join(" ");
  return (
    <Button variant="quiet" className={classes} aria-label={t(COPY.CP_760)} se={null} onClick={onClick}>
      <svg className="home-back__arrow" viewBox="0 0 24 24" aria-hidden="true" width="1em" height="1em">
        <path {...PEN} d="M19 12H6M11 6l-6 6 6 6" />
      </svg>
      <span>{t(COPY.CP_784)}</span>
    </Button>
  );
}
