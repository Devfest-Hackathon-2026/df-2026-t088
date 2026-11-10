// PG-001 島の地図（/home）の上の帯の左に置く入口（D-250）。「出すもの」（まだ出していない数の札つき。PG-007 へ）と、
// カメラ（PG-010 へ。VITE_PRINT_CHILD_CAPTURE が on の時だけ。D-164）。数は課題の一覧を読んで数え、読み込み中・失敗・0件は札を出さない
import { Button } from "../../components/Button";
import { COPY } from "../../copy";
import { useText } from "../../grade";
import type { HomeSubPath } from "../../routing";
import { printReadIsReal } from "../print/api";
import { notSubmitted } from "./rules";
import { useHomeData } from "./use-home-data";
import "./home-entries.css";

const CAMERA_PEN = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;
// 撮影の入口は、設定が on で、本物の読み取りの build のときだけ（#281。見本の応答を公開に出さない）
const childCaptureEnabled = () => import.meta.env.VITE_PRINT_CHILD_CAPTURE === "on" && printReadIsReal();

export function HomeEntries({ onOpen, showToast }: { onOpen: (path: HomeSubPath) => void; showToast: (text: string) => void }) {
  const t = useText();
  const home = useHomeData(showToast, { timetable: false });
  const count = home.assignments.status === "ready" ? notSubmitted(home.assignments.data.assignments).length : 0;
  return (
    <div className="home-entries">
      <Button
        variant="quiet"
        className="home-entries__assignments"
        data-home-entry="assignments"
        onClick={() => onOpen("/home/assignments")}
      >
        <span>{t(COPY.CP_1277)}</span>
        {/* 見える文字（「出すもの」と数）を名前の頭に置いたまま、続きは読み上げだけ（axe の label-content-name-mismatch） */}
        {count > 0 && <><span className="home-entries__count">{count}</span><span className="visually-hidden">{t(COPY.CP_1278)}</span></>}
      </Button>
      {/* CMP-001 quiet の札。カメラの線画は PG-010（プリントの撮影）へ。読み上げは CP-861（D-164） */}
      {childCaptureEnabled() && (
        <Button variant="quiet" className="home-entries__camera" data-home-entry="print" aria-label={t(COPY.CP_861)} title={t(COPY.CP_861)} onClick={() => onOpen("/home/print")}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path {...CAMERA_PEN} d="M4 10h6l3-4h6l3 4h6v16H4z" />
            <circle {...CAMERA_PEN} cx="16" cy="18" r="5" />
          </svg>
        </Button>
      )}
    </div>
  );
}
