import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { HomeBackButton } from "../../components/HomeBackButton";
import { NotFoundError, loadHandoutList, readPrintHandout } from "../home/api";
import type { PrintHandout } from "../home/types";
import type { ExplainProblem, LeverParams } from "./types";
import { CLASS_CAPTURE_COPY } from "./class-capture-copy";
import { ExplainCard } from "./ExplainCard";
import { HandoutFractionPage } from "./HandoutFractionPage";
import { PrintPage } from "./PrintPage";
import { printReadIsReal } from "./api";

const HANDOUT_COPY = {
  loadFailed: "説明を読みこめませんでした。もう一度お試しください。",
  handoutMissing: "この説明は見つかりませんでした。",
  classMissing: "この学級コードは見つかりませんでした。先生にたしかめてね",
  empty: "先生からの説明は、まだありません。",
} as const;

type Props = {
  /** ログインしていない子（/join・配られたリンク）には、帰るホームが無いので渡さない */
  onGoHome?: () => void;
  /** 配られたリンク（1 件） */
  handoutId?: string;
  /** /join/{code} で開いた学級コード */
  classCode?: string;
};

export function HandoutPage({ onGoHome, handoutId, classCode }: Props) {
  const [items, setItems] = useState<PrintHandout[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrintHandout | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [classMissing, setClassMissing] = useState(false);
  // 先生が「子どもが自分で撮ってよい」を入れた学級のときだけ、撮るボタンを出す
  const [capture, setCapture] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [handoutMissing, setHandoutMissing] = useState(false);
  // 配られたリンクから「もどる」を押したときだけ、一覧を読む
  const [listWanted, setListWanted] = useState(handoutId === undefined);

  useEffect(() => {
    if (handoutId === undefined) return;
    let alive = true;
    readPrintHandout(handoutId)
      .then((handout) => { if (alive) setSelected(handout); })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof NotFoundError) setHandoutMissing(true); else setFailed(true);
      });
    return () => { alive = false; };
  }, [handoutId]);

  useEffect(() => {
    if (!listWanted) return;
    let alive = true;
    loadHandoutList(classCode)
      .then((result) => {
        if (!alive) return;
        setItems(result.items); setClassName(result.className); setClassMissing(result.classMissing); setCapture(result.childCapture ? result.classCode : null); setLoaded(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [classCode, listWanted]);

  const problem: ExplainProblem | null = selected && selected.templateId !== "sansu-fraction-addsub" ? selected.templateId === "rika-lever"
    ? { templateId: "rika-lever", questionText: selected.questionText, params: selected.params as unknown as LeverParams, approved: true }
    : { templateId: "rika-moon", questionText: selected.questionText, params: {}, approved: true } : null;
  const retake = () => { setSelected(null); setListWanted(true); };
  // ホームが無い子は、説明を開いている間だけ「← ホーム」を一覧へ戻る手にする。学級コードで入った子だけ（配られたリンクの子は一覧を持たない）
  const backAction = onGoHome ?? (problem && classCode !== undefined ? retake : undefined);
  const showList = listWanted && !classMissing;
  // 分数は説明カードではなく、タイルの学習でその 1 問を解く
  if (selected?.templateId === "sansu-fraction-addsub") {
    return <HandoutFractionPage key={selected.id} handoutId={selected.id} questionText={selected.questionText} params={selected.params} onBack={retake} />;
  }
  if (capturing && capture !== null) return <PrintPage classCode={capture} onGoHome={() => setCapturing(false)} />;
  return (
    <div className="print">
      <header className="print__bar">{backAction ? <HomeBackButton className="print__back" onClick={backAction} /> : null}<h1 className="print__title">先生からの動く説明</h1></header>
      {problem ? <main className="print__main"><ExplainCard problem={problem} handoutId={selected?.id} /></main> : (
        <main className="print__main">
          {className !== null && showList ? <h2 className="print__class">{className}</h2> : null}
          {failed && <p role="alert">{HANDOUT_COPY.loadFailed}</p>}
          {handoutMissing && !failed ? <p role="alert">{HANDOUT_COPY.handoutMissing}</p> : null}
          {classMissing && !failed ? <p role="alert">{HANDOUT_COPY.classMissing}</p> : null}
          {showList && capture !== null && printReadIsReal() ? <p><Button variant="primary" onClick={() => setCapturing(true)}>{CLASS_CAPTURE_COPY.start}</Button></p> : null}
          {showList && loaded && items.length === 0 && !failed ? <p>{HANDOUT_COPY.empty}</p> : null}
          {showList && items.length > 0 ? (
            <ul>{items.map((item) => <li key={item.id}><Button variant="secondary" onClick={() => setSelected(item)}>{item.questionText}</Button></li>)}</ul>
          ) : null}
        </main>
      )}
    </div>
  );
}
