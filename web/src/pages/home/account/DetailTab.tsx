import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/Button";
import { Meter } from "../../../components/Meter";
import { Ruby } from "../../../components/Ruby";
import { COPY } from "../../../copy";
import { SUBJECTS } from "../../../data";
import { GRADES } from "../../../data/kanji-grades";
import { DEFAULT_GRADE, useGradeControl, useText } from "../../../grade";
import type { Game } from "../../../game/use-game";
import { subjectProgressRows } from "../../../game/subject-progress";
import { currentAccount, logOut } from "../../../login";

interface DetailTabProps {
  game: Game;
  showToast: (text: string) => void;
  /** 今見えているタブか。アバターのタブへ替えた時は、ログアウトのたしかめをボタンの行に戻す（D-220） */
  active: boolean;
}

// CMP-028 くわしくのタブ：教科のすすみ、ログイン（D-197）
export function DetailTab({ game, showToast, active }: DetailTabProps) {
  const t = useText();
  const gradeControl = useGradeControl();
  const grade = gradeControl?.grade ?? DEFAULT_GRADE;
  const { rows, pending } = subjectProgressRows(grade, game.state);
  const account = currentAccount();
  const [confirming, setConfirming] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!active) setConfirming(false);
  }, [active]);
  // 替わった時は「やめる」へ、やめた時は「ログアウト」へフォーカスを移す（D-220）
  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector("button")?.focus();
    else if (restoreFocus.current) rowRef.current?.querySelector("button")?.focus();
    restoreFocus.current = false;
  }, [confirming]);
  const cancel = () => {
    restoreFocus.current = true;
    setConfirming(false);
  };
  // /login への移動は App が useLoggedIn を見てする。失敗したら CP-792 を出し、たしかめの形のまま残す
  const logout = () => {
    if (!logOut()) showToast(t(COPY.CP_792));
  };
  const question = t(account?.name ? COPY.CP_1220(account.name) : COPY.CP_1222);
  return (
    <>
      {gradeControl && <label className="account-learning-grade">
        <Ruby text="[学|まな]ぶ[学年|がくねん]" />
        <select value={grade} onChange={(event) => {
          const selection = GRADES.find((candidate) => String(candidate) === event.target.value);
          if (selection !== undefined) gradeControl.setLearningGrade(selection);
        }}>
          {GRADES.map((option) => <option key={option} value={option}>{option}年</option>)}
        </select>
      </label>}
      <section className="account-section">
        <h3 className="account-section__title"><Ruby text={COPY.CP_1133} /></h3>
        {rows.length === 0 && pending > 0 ? <p className="account-small account-small--muted"><Ruby text={COPY.CP_1137} /></p> : null}
        <ul className="account-subjects">
          {rows.map((row) => {
            const subject = SUBJECTS.find((candidate) => candidate.id === row.subjectId);
            const spoken = t(COPY.CP_1136(subject?.name ?? "", row.total, row.cleared, row.level));
            return (
              <li key={row.subjectId} className="account-subject">
                <span className="visually-hidden">{spoken}</span>
                <span className="account-subject__dot" style={{ background: subject?.color }} aria-hidden="true" />
                <span className="account-subject__name" aria-hidden="true"><Ruby text={subject?.name ?? ""} /></span>
                <span className="account-subject__meter" aria-hidden="true"><Meter ratio={row.total ? row.cleared / row.total : 0} label={spoken} /></span>
                <span className="account-subject__count" aria-hidden="true"><Ruby text={COPY.CP_1134(row.cleared, row.total)} /></span>
                <span className="account-subject__level" aria-hidden="true">{COPY.CP_201(row.level)}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="account-small account-small--muted">{account ? t(COPY.CP_795(account.provider, account.email)) : ""}</p>
      {confirming ? (
        <div className="account-confirm" role="group" aria-labelledby="account-logout-question">
          <p id="account-logout-question" className="account-confirm__question">{question}</p>
          <div ref={confirmRef} className="account-confirm__actions">
            <Button variant="primary" onClick={cancel}>{t(COPY.CP_243)}</Button>
            <Button variant="secondary" onClick={logout}>{t(COPY.CP_1221)}</Button>
          </div>
        </div>
      ) : (
        <div ref={rowRef} className="account-actions">
          <Button variant="secondary" onClick={() => setConfirming(true)}>{t(COPY.CP_796)}</Button>
        </div>
      )}
    </>
  );
}
