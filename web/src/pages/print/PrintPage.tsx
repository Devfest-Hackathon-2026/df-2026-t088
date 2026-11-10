// PG-010 しゃしんで しつもん（D-164〜D-172）。とる → かこむ → まつ → せつめい を1つの部品の中で切り替える
// 写真はメモリ（object URL）にだけ置く。localStorage・IndexedDB・Cache には入れない（D-165）
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "../../components/Button";
import { HomeBackButton } from "../../components/HomeBackButton";
import { COPY } from "../../copy";
import { useText } from "../../grade";
import { PrintReadError, readPrint } from "./api";
import { cropToLasso, isTooSmall, lassoBounds } from "./capture";
import { CLASS_CAPTURE_COPY } from "./class-capture-copy";
import { ExplainCard } from "./ExplainCard";
import { LassoFrame } from "./LassoFrame";
import type { ExplainProblem, Point, PrintErrorKind, PrintReadResponse } from "./types";
import "./print.css";

type Stage = "take" | "lasso" | "wait" | "explain";

/** 上の帯に出す段（CP-862）。まつ は かこむ の続きとして 2 番目の段のまま */
const STEP_OF: Record<Stage, number> = { take: 0, lasso: 1, wait: 1, explain: 2 };

const FAIL_TEXT: Record<PrintErrorKind, string> = {
  unreadable: COPY.CP_879,
  "not-supported": COPY.CP_880,
  unavailable: COPY.CP_881,
  timeout: COPY.CP_882,
  rate: COPY.CP_884,
  offline: COPY.CP_883,
  closed: CLASS_CAPTURE_COPY.closed,
  daily: CLASS_CAPTURE_COPY.daily,
};

interface Photo {
  url: string;
  width: number;
  height: number;
}

/** 写真の大きさを得る。createImageBitmap があれば使い、なければ <img> の decode で得る */
async function decodePhoto(file: Blob, url: string): Promise<{ width: number; height: number; image: CanvasImageSource & { width: number; height: number }; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, image: bitmap, close: () => bitmap.close?.() };
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight, image: img, close: () => {} };
}

/** 768px 以上か。matchMedia が無い環境（jsdom）は false */
function useWide(): boolean {
  const query = "(min-width: 768px)";
  const read = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [wide, setWide] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);
  return wide;
}

/** classCode：学級コードで入った子どもの撮影。読み取りの要求に付け、読み取れた説明は学級に残る */
export function PrintPage({ onGoHome, classCode }: { onGoHome: () => void; classCode?: string }) {
  const t = useText();
  const wide = useWide();
  const [stage, setStage] = useState<Stage>("take");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [path, setPath] = useState<Point[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [error, setError] = useState<PrintErrorKind | null>(null);
  const [demandRecorded, setDemandRecorded] = useState(false);
  const [result, setResult] = useState<(Omit<PrintReadResponse, "problems"> & { problems: ExplainProblem[] }) | null>(null);
  const [index, setIndex] = useState(0);

  // 写真に関わる物。state は表示用、ここは後始末用（unmount でも消せるように）
  const photoUrl = useRef<string | null>(null);
  const croppedUrlRef = useRef<string | null>(null);
  const bitmap = useRef<{ image: CanvasImageSource & { width: number; height: number }; close: () => void } | null>(null);
  const croppedBlob = useRef<Blob | null>(null);
  const controller = useRef<AbortController | null>(null);
  // 写真を選んだ後の decode 待ちの間に、やめた・選び直した時の食い違いを防ぐ
  const pickToken = useRef(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const albumInput = useRef<HTMLInputElement>(null);
  const failActions = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const dropCropped = useCallback(() => {
    if (croppedUrlRef.current) URL.revokeObjectURL(croppedUrlRef.current);
    croppedUrlRef.current = null;
    croppedBlob.current = null;
    setCroppedUrl(null);
  }, []);

  /** 通信と、写真・切り抜きを全部捨てる。とりなおす・やめる・ホームへ戻る・成功・unmount で通る */
  const discardAll = useCallback(() => {
    pickToken.current += 1;
    controller.current?.abort();
    controller.current = null;
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = null;
    bitmap.current?.close();
    bitmap.current = null;
    dropCropped();
    setPhoto(null);
    setPath([]);
    setHint(null);
    setError(null);
    setDemandRecorded(false);
  }, [dropCropped]);

  useEffect(() => () => {
    // unmount。state は触らず、参照だけ消す
    controller.current?.abort();
    if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
    if (croppedUrlRef.current) URL.revokeObjectURL(croppedUrlRef.current);
    bitmap.current?.close();
  }, []);

  const retake = () => {
    discardAll();
    setResult(null);
    setIndex(0);
    setStage("take");
  };
  const goHome = () => {
    discardAll();
    onGoHome();
  };

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    discardAll();
    const token = pickToken.current;
    const url = URL.createObjectURL(file);
    try {
      const decoded = await decodePhoto(file, url);
      if (token !== pickToken.current) {
        URL.revokeObjectURL(url);
        decoded.close();
        return;
      }
      photoUrl.current = url;
      bitmap.current = decoded;
      setPhoto({ url, width: decoded.width, height: decoded.height });
      setStage("lasso");
    } catch {
      URL.revokeObjectURL(url);
      if (token === pickToken.current) setHint(COPY.CP_879);
    }
  };

  const run = useCallback(async (blob: Blob) => {
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    setError(null);
    setStage("wait");
    try {
      const response = await readPrint(blob, mine.signal, classCode);
      if (mine.signal.aborted) return;
      // 分数の式は説明カードで見せない（先生が配ると、配られた子がタイルの学習で解く）。ここでは対象外に数える
      const explainable = response.problems.filter((problem): problem is ExplainProblem => problem.templateId !== "sansu-fraction-addsub");
      if (explainable.length === 0) throw new PrintReadError("not-supported");
      // 成功。元の写真と切り抜きは捨て、読みとった問題だけ持つ（D-165）
      discardAll();
      setResult({ ...response, problems: explainable, unsupportedCount: response.unsupportedCount + response.problems.length - explainable.length });
      setIndex(0);
      setStage("explain");
    } catch (failure) {
      if (mine.signal.aborted) return;
      setDemandRecorded(failure instanceof PrintReadError && failure.demandRecorded);
      setError(failure instanceof PrintReadError ? failure.kind : "unavailable");
    }
  }, [discardAll, classCode]);

  const send = async () => {
    if (!photo || !bitmap.current) return;
    if (path.length < 3) return setHint(COPY.CP_873);
    if (isTooSmall(lassoBounds(path), photo.width, photo.height)) return setHint(COPY.CP_874);
    setHint(null);
    const token = pickToken.current;
    let blob: Blob;
    try {
      blob = await cropToLasso(bitmap.current.image, path);
    } catch {
      return setHint(COPY.CP_881);
    }
    if (token !== pickToken.current) return;
    dropCropped();
    croppedBlob.current = blob;
    croppedUrlRef.current = URL.createObjectURL(blob);
    setCroppedUrl(croppedUrlRef.current);
    void run(blob);
  };

  const cancelWait = () => {
    controller.current?.abort();
    controller.current = null;
    dropCropped();
    setError(null);
    setStage("lasso");
  };

  const resend = () => {
    if (croppedBlob.current) void run(croppedBlob.current);
  };

  // 失敗の文を出した時は、主ボタンに focus を移す
  useEffect(() => {
    if (error) failActions.current?.querySelector("button")?.focus();
  }, [error]);
  // 説明を開いた時、カードを入れ替えた時は題に focus
  useEffect(() => {
    if (stage === "explain") headingRef.current?.focus();
  }, [stage, index, wide]);

  const step = STEP_OF[stage];
  const names = COPY.CP_862.steps;
  const problems = result?.problems ?? [];
  const total = problems.length;
  const multi = wide && total > 1;
  const unsupported = result?.unsupportedCount ?? 0;
  const failRetryable = error !== null && error !== "unreadable" && error !== "not-supported" && error !== "closed" && error !== "daily";

  return (
    <div className="print" data-stage={stage}>
      <header className="print__bar">
        <HomeBackButton className="print__back" onClick={goHome} />
        <h1 className="print__title">{t(COPY.CP_860)}</h1>
        <ol className="print__steps" aria-hidden="true">
          {names.map((name, i) => (
            <li key={name} className="print-step" data-state={i < step ? "done" : i === step ? "now" : "next"}>
              <span className="print-step__mark">{i < step ? "✓" : i + 1}</span>
              <span className="print-step__name">{t(name)}</span>
            </li>
          ))}
        </ol>
        {wide && stage === "explain" && total > 1 && <span className="print__count">{t(COPY.CP_886(index + 1, total))}</span>}
      </header>
      <p className="print__sr" role="status">{t(COPY.CP_862.announce(step + 1, names[step]))}</p>

      {stage === "take" && (
        <main className="print__main print-take">
          <svg className="print-take__art" viewBox="0 0 160 120" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 14h58l14 14v78H30z" />
              <path d="M88 14v14h14M42 40h38M42 54h30M42 68h38" />
              <rect x="92" y="70" width="52" height="36" rx="6" />
              <circle cx="118" cy="88" r="10" />
              <path d="M104 70l4-7h20l4 7" />
            </g>
          </svg>
          <p className="print-take__lead">{t(COPY.CP_863)}</p>
          <p className="print-take__note">{t(COPY.CP_864)}</p>
          {hint && <p className="print__alert" role="alert">{t(hint)}</p>}
          <div className="print__actions">
            <Button variant="primary" se="enter" onClick={() => cameraInput.current?.click()}>{t(COPY.CP_865)}</Button>
            <Button variant="secondary" onClick={() => albumInput.current?.click()}>{t(COPY.CP_866)}</Button>
          </div>
          <input ref={cameraInput} className="print__file" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={onPick} />
          <input ref={albumInput} className="print__file" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={onPick} />
        </main>
      )}

      {stage === "lasso" && photo && (
        <main className="print__main print-lasso">
          <LassoFrame
            src={photo.url}
            width={photo.width}
            height={photo.height}
            path={path}
            onPathChange={(next) => {
              setPath(next);
              setHint(null);
            }}
            label={t(COPY.CP_875)}
            description={t(COPY.CP_876)}
            placeOnTap
          />
          <div className="print-lasso__side">
            <p className="print-lasso__lead">{t(COPY.CP_867)}</p>
            <p className="print-lasso__note">{t(COPY.CP_868)}</p>
            {hint && <p className="print__alert" role="alert">{t(hint)}</p>}
            <div className="print__actions">
              <Button variant="primary" se="enter" onClick={send}>{t(COPY.CP_869)}</Button>
              <Button variant="text" onClick={() => { setPath([]); setHint(null); }}>{t(COPY.CP_870)}</Button>
              <Button variant="secondary" onClick={retake}>{t(COPY.CP_871)}</Button>
              <Button variant="quiet" se={null} onClick={goHome}>{t(COPY.CP_872)}</Button>
            </div>
          </div>
        </main>
      )}

      {stage === "wait" && (
        <main className="print__main print-wait">
          {croppedUrl && <img className="print-wait__thumb" src={croppedUrl} alt="" />}
          {error === null ? (
            <>
              <p className="print-wait__lead" role="status">{t(COPY.CP_877)}</p>
              <p className="print-wait__note">{t(COPY.CP_878)}</p>
              <div className="print__actions">
                <Button variant="quiet" onClick={cancelWait}>{t(COPY.CP_872)}</Button>
              </div>
            </>
          ) : (
            <>
              <p className="print__alert" role="alert">{t(FAIL_TEXT[error])}</p>
              {demandRecorded && error === "not-supported" && <p>先生に、この単元の説明がほしいと伝わりました</p>}
              <div className="print__actions" ref={failActions}>
                {failRetryable ? (
                  <>
                    <Button variant="primary" se="enter" onClick={resend}>{t(COPY.CP_885)}</Button>
                    <Button variant="secondary" onClick={retake}>{t(COPY.CP_871)}</Button>
                  </>
                ) : (
                  <Button variant="primary" se="enter" onClick={retake}>{t(COPY.CP_871)}</Button>
                )}
              </div>
            </>
          )}
        </main>
      )}

      {stage === "explain" && result && (
        <main className="print__main print-explain">
          {unsupported > 0 && <p className="print-explain__note" role="status">{t(COPY.CP_895(unsupported))}</p>}
          {result.demandRecorded && <p>先生に、この単元の説明がほしいと伝わりました</p>}
          {wide ? (
            <>
              <ExplainCard key={index} problem={problems[index]} onRetake={retake} handoutId={problems[index].handoutId} headingId={`print-card-${index}`} headingRef={headingRef} />
              {multi && (
                <div className="print-explain__nav">
                  {index > 0 && <Button variant="secondary" onClick={() => setIndex(index - 1)}>{t(COPY.CP_888)}</Button>}
                  {index < total - 1
                    ? <Button variant="secondary" onClick={() => setIndex(index + 1)}>{t(COPY.CP_887)}</Button>
                    : <Button variant="secondary" onClick={retake}>{t(COPY.CP_896)}</Button>}
                </div>
              )}
              {!multi && <div className="print-explain__nav"><Button variant="secondary" onClick={retake}>{t(COPY.CP_896)}</Button></div>}
            </>
          ) : (
            <>
              {problems.map((problem, i) => (
                <ExplainCard key={i} problem={problem} onRetake={retake} handoutId={problem.handoutId} headingId={`print-card-${i}`} headingRef={i === 0 ? headingRef : undefined} />
              ))}
              <div className="print-explain__nav">
                <Button variant="secondary" onClick={retake}>{t(COPY.CP_896)}</Button>
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
