import { useCallback, useEffect, useRef, useState } from "react";
import { playSe } from "../../../audio/use-bgm";
import { AvatarPhoto } from "../../../components/AvatarPhoto";
import { GearIcon } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { Ruby } from "../../../components/Ruby";
import { COPY } from "../../../copy";
import { EQUIPMENT, SUBJECTS } from "../../../data";
import type { SubjectId } from "../../../data";
import { useText } from "../../../grade";
import { parseDurationMs } from "../../../game/logic";
import type { Game } from "../../../game/use-game";
import { BG_IDS, DEFAULT_LOOK, FACE_IDS, FRAME_IDS, POSE_IDS, STAMP_IDS, loadPhoto, savePhoto } from "../../../photo";
import type { PhotoLook } from "../../../photo";
import { TabList } from "./TabList";
import { LockedPicture, RadioChoices, bgPicture, facePicture, framePicture, posePicture, stampPicture } from "./choices";
import type { Choice } from "./choices";

// CMP-028 アバターのタブ（D-195〜D-201）。ポーズ・かお・はいけい・かざりは「これにする」まで下書き。
// 「しゃしんを とる」→ MOT-030（CMP-041）→ とったあと。パネルを閉じると、この部品ごと捨てる
type Kind = "gear" | "pose" | "face" | "bg" | "deco";
type Phase = "idle" | "flash" | "print" | "taken";

const KINDS: readonly { id: Kind; label: string }[] = [
  { id: "gear", label: COPY.CP_1140 },
  { id: "pose", label: COPY.CP_1141 },
  { id: "face", label: COPY.CP_1142 },
  { id: "bg", label: COPY.CP_1143 },
  { id: "deco", label: COPY.CP_1144 },
];

/** 教科の印を描ける教科（CP-1149 の注）。ほかの教科ではスタンプの候補を出さない */
const STAMP_SUBJECTS: readonly SubjectId[] = ["sansu", "kokugo", "rika"];
const FALLBACK_FLASH_MS = 150;
const FALLBACK_PRINT_MS = 600;

const durationOf = (name: string, fallback: number) =>
  parseDurationMs(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface AvatarTabProps {
  game: Game;
  showToast: (text: string) => void;
}

function CameraIcon() {
  return (
    <svg className="account-camera" viewBox="0 0 32 32" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M5 11h5l2-4h8l2 4h5v14H5zM16 22a5 5 0 1 0 .01 0" />
    </svg>
  );
}

export function AvatarTab({ game, showToast }: AvatarTabProps) {
  const t = useText();
  const subjectId = game.subjectId;
  const hasSubjectStamp = STAMP_SUBJECTS.includes(subjectId);

  const [kind, setKind] = useState<Kind>("gear");
  // 今の写真の選び方から始める（D-201）。教科の印を描けない教科では、印は「なし」から
  const [draft, setDraft] = useState<Omit<PhotoLook, "gear">>(() => {
    const { pose, face, bg, frame, stamp } = loadPhoto() ?? { ...DEFAULT_LOOK };
    return { pose, face, bg, frame, stamp: stamp === "subject" && !hasSubjectStamp ? "none" : stamp };
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [taken, setTaken] = useState<PhotoLook | null>(null);
  const timers = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<"shutter" | "confirm" | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // 状態が替わった後（ボタンが出てから）にフォーカスを置く
  useEffect(() => {
    if (focusAfter.current === "shutter" && phase === "idle") rootRef.current?.querySelector<HTMLElement>(".account-shutter")?.focus();
    if (focusAfter.current === "confirm" && phase === "taken") rootRef.current?.querySelector<HTMLElement>(".account-confirm button")?.focus();
    focusAfter.current = null;
  }, [phase]);

  const worn = game.wornGear;
  const preview: PhotoLook = { ...draft, gear: worn };
  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const finishTaking = () => {
    clearTimers();
    focusAfter.current = "confirm";
    setPhase("taken");
  };

  // MOT-030：カシャ（光）→ ういーん（せり出し）→ とったあと。減らす設定では、光らせず、せり出さず、すぐとったあと
  const shoot = () => {
    setTaken(preview);
    playSe("shutter");
    if (prefersReducedMotion()) {
      finishTaking();
      return;
    }
    setPhase("flash");
    const flash = durationOf("--duration-shutter-flash", FALLBACK_FLASH_MS);
    const print = durationOf("--duration-shutter-print", FALLBACK_PRINT_MS);
    timers.current.push(
      window.setTimeout(() => {
        playSe("print");
        setPhase("print");
        timers.current.push(window.setTimeout(finishTaking, print));
      }, flash),
    );
  };

  // これにする：選び方を写真として保存する。失敗したらとったあとのまま（D-199）
  const keep = () => {
    if (!taken) return;
    if (!savePhoto({ ...taken, gear: worn })) {
      showToast(t(COPY.CP_1155));
      return;
    }
    showToast(t(COPY.CP_1154));
    focusAfter.current = "shutter";
    setPhase("idle");
  };

  const retake = () => {
    focusAfter.current = "shutter";
    setPhase("idle");
  };

  const choice = <T extends string>(id: T, label: string, picture: Choice<T>["picture"]): Choice<T> => ({ id, label: t(label), picture });
  const frameChoices = FRAME_IDS.map((id) => choice(id, COPY.CP_1148[id], framePicture(preview, id)));
  const stampChoices = STAMP_IDS.filter((id) => id !== "subject" || hasSubjectStamp).map((id) =>
    choice(id, COPY.CP_1149[id], stampPicture(id, subjectId)),
  );

  const shooting = phase === "flash" || phase === "print";
  const showTaken = phase === "taken" && taken;
  // 途中で押したら、演出を飛ばしてとったあとの形へ（MOT-030）
  const skip = () => {
    if (shooting) finishTaking();
  };

  const kindLabel = (id: Kind) => KINDS.find((item) => item.id === id)?.label ?? "";
  return (
    <div ref={rootRef} className={`account-avatar${shooting ? " account-avatar--shooting" : ""}`} onClickCapture={skip}>
      <div className="account-slot">
        {phase === "print" && taken ? (
          <div className="account-print"><AvatarPhoto look={taken} shape="cheki" stampSubject={subjectId} /></div>
        ) : (
          <AvatarPhoto look={showTaken && taken ? taken : preview} shape="cheki" stampSubject={subjectId} />
        )}
        {phase === "flash" && <span className="account-flash" aria-hidden="true" />}
      </div>
      <p className="account-confirm__text" aria-live="polite">{showTaken ? <Ruby text={COPY.CP_1151} /> : null}</p>
      {showTaken ? (
        <div className="account-confirm">
          <Button variant="primary" se="enter" onClick={keep}>{COPY.CP_1152}</Button>
          <Button variant="secondary" onClick={retake}>{COPY.CP_1153}</Button>
        </div>
      ) : null}
      {phase === "idle" && (
        <>
          <TabList
            tabs={KINDS}
            value={kind}
            onChange={setKind}
            idPrefix="account-kind"
            panelIdOf={() => "account-kind-panel"}
            className="account-kinds"
          />
          <div id="account-kind-panel" role="tabpanel" aria-labelledby={`account-kind-tab-${kind}`} className="account-choices-area">
            {kind === "gear" && (
              <div role="group" aria-label={t(kindLabel("gear"))} className="account-choices">
                {EQUIPMENT.map((item) => {
                  const name = t(item.name);
                  if (item.level > game.level) {
                    // 鍵：押せない。読み上げは「{装備の名前}。Lv.{n} で手に入ります」
                    return (
                      <button key={item.id} type="button" aria-disabled="true" aria-label={`${name}。${t(COPY.CP_308(item.level))}`} className="account-choice account-choice--locked">
                        <LockedPicture />
                        <span className="account-choice__level">{COPY.CP_201(item.level)}</span>
                      </button>
                    );
                  }
                  const on = worn.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={name}
                      className={`account-choice${on ? " account-choice--on" : ""}`}
                      onClick={() => {
                        playSe("select");
                        game.toggleGear(item.id);
                      }}
                    >
                      <span className="account-choice__gear"><GearIcon gearId={item.id} /></span>
                    </button>
                  );
                })}
              </div>
            )}
            {kind === "pose" && (
              <RadioChoices
                label={t(COPY.CP_1141)}
                choices={POSE_IDS.map((id) => choice(id, COPY.CP_1145[id], posePicture(preview, id)))}
                value={draft.pose}
                onChange={(id) => set("pose", id)}
              />
            )}
            {kind === "face" && (
              <RadioChoices
                label={t(COPY.CP_1142)}
                choices={FACE_IDS.map((id) => choice(id, COPY.CP_1146[id], facePicture(preview, id)))}
                value={draft.face}
                onChange={(id) => set("face", id)}
              />
            )}
            {kind === "bg" && (
              <RadioChoices
                label={t(COPY.CP_1143)}
                choices={BG_IDS.map((id) =>
                  choice(id, id === "grid" ? COPY.CP_1147.grid : COPY.CP_1147.subject(SUBJECTS.find((subject) => subject.id === id)?.name ?? ""), bgPicture(preview, id)),
                )}
                value={draft.bg}
                onChange={(id) => set("bg", id)}
              />
            )}
            {kind === "deco" && (
              <>
                <p className="account-row-head"><Ruby text={COPY.CP_1148.label} /></p>
                <RadioChoices label={t(COPY.CP_1148.label)} choices={frameChoices} value={draft.frame} onChange={(id) => set("frame", id)} />
                <p className="account-row-head"><Ruby text={COPY.CP_1149.label} /></p>
                <RadioChoices label={t(COPY.CP_1149.label)} choices={stampChoices} value={draft.stamp} onChange={(id) => set("stamp", id)} />
              </>
            )}
          </div>
          <Button variant="primary" className="account-shutter" onClick={shoot}>
            <CameraIcon />
            <Ruby text={COPY.CP_1150} />
          </Button>
        </>
      )}
    </div>
  );
}
