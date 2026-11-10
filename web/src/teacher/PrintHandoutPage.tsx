import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ExplainCard } from "../pages/print/ExplainCard";
import { cropToLasso, isTooSmall, JPEG_QUALITY, lassoBounds, scaledSize } from "../pages/print/capture";
import { LassoFrame } from "../pages/print/LassoFrame";
import { fractionExpression, fractionRangeReason } from "../pages/print/fraction-addsub";
import type { FractionAddSubParams, LeverParams, Point, PrintReadResponse, ReadProblem } from "../pages/print/types";
import type { PrintHandout } from "../pages/home/types";
import { TeacherNav } from "./TeacherNav";
import { useApproverKey } from "./approver-key";
import { HANDOUT_WITHDRAW_COPY, STUDIO_COPY, WORKSPACE_COPY } from "./copy";
import { useTeacherSession } from "./workspace";
import { PrintDemandPanel } from "./PrintDemandPanel";
import "./PrintHandoutPage.css";
import "../pages/print/print.css";

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
const classroomShareScriptUrl = "https://apis.google.com/js/platform.js";
const FRACTION_REVIEW_NOTE = "分数は、写真と見比べてからチェックしてください（読み違いをプログラムで確かめられないため）";
const FULL_PHOTO_LABEL = "この写真を読み取る";
const LASSO_PHOTO_LABEL = "一部だけ読み取る";

function handoutUrl(id: string) {
  return `${window.location.origin}/home/handouts/${encodeURIComponent(id)}`;
}

// 429 のときは server の文（error.message）をそのまま出す。読めなければ fallback
type ReadError = { code?: unknown; message?: unknown; scope?: unknown; retryAfterSeconds?: unknown; demandRecorded?: unknown };

async function errorOf(response: Response): Promise<ReadError> {
  try {
    const body = await response.json() as { error?: ReadError };
    return typeof body.error === "object" && body.error !== null ? body.error : {};
  } catch { return {}; }
}

// 1 分の上限（scope が minute）は、server の子ども向けの文ではなく、待つ秒数を先生向けに出す。1 日の上限は server の文のまま
async function rateLimitMessage(response: Response): Promise<string> {
  const error = await errorOf(response);
  if (error.scope === "minute" && typeof error.retryAfterSeconds === "number" && error.retryAfterSeconds > 0) return WORKSPACE_COPY.readTooFast(Math.ceil(error.retryAfterSeconds));
  return typeof error.message === "string" && error.message !== "" ? error.message : WORKSPACE_COPY.rateLimited;
}

function classroomFallbackUrl(url: string) {
  return `https://classroom.google.com/share?url=${encodeURIComponent(url)}`;
}

async function fullPhoto(image: ImageBitmap): Promise<Blob> {
  const size = scaledSize(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width; canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas が使えません");
  context.drawImage(image, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("写真を JPEG にできませんでした")), "image/jpeg", JPEG_QUALITY));
}

// server/src/print/templates.ts の validateLever と同じ範囲を画面側にも写す。
function validLeverParams(params: LeverParams): boolean {
  const { left, right } = params;
  if (!Number.isInteger(left.pos) || left.pos < 1 || left.pos > 6 || !Number.isInteger(right.pos) || right.pos < 1 || right.pos > 6) return false;
  if (!Number.isInteger(left.g) || left.g < 10 || left.g > 100 || left.g % 10 !== 0) return false;
  const answer = (left.g * left.pos) / right.pos;
  return Number.isInteger(answer) && answer >= 10 && answer <= 100 && answer % 10 === 0;
}

function leverChoices(params: LeverParams, field: "leftPos" | "leftG" | "rightPos"): number[] {
  const values = field === "leftG" ? Array.from({ length: 10 }, (_, index) => (index + 1) * 10) : [1, 2, 3, 4, 5, 6];
  return values.filter((value) => validLeverParams({
    left: { pos: field === "leftPos" ? value : params.left.pos, g: field === "leftG" ? value : params.left.g },
    right: { pos: field === "rightPos" ? value : params.right.pos },
  }));
}

// 分数の型の直す欄。選べる値は箱の大きさ（分母 2〜12、分子は 2 つ分まで）。範囲の外に直したら、理由を出して配れない
const FRACTION_DENS = Array.from({ length: 11 }, (_, index) => index + 2);
const FRACTION_NUMS = Array.from({ length: 24 }, (_, index) => index + 1);
type FractionField = "leftNum" | "leftDen" | "op" | "rightNum" | "rightDen";

function editedFraction(params: FractionAddSubParams, field: FractionField, value: string): FractionAddSubParams {
  const left = { ...params.left };
  const right = { ...params.right };
  if (field === "leftNum") left.num = Number(value);
  if (field === "leftDen") left.den = Number(value);
  if (field === "rightNum") right.num = Number(value);
  if (field === "rightDen") right.den = Number(value);
  return { left, op: field === "op" ? (value === "-" ? "-" : "+") : params.op, right };
}

// 5 つの値は式の並び（左の分子・分母、記号、右の分子・分母）で 1 行に置く。1 画面に収めるため
function FractionRows({ params, onEdit }: { params: FractionAddSubParams; onEdit: (field: FractionField, value: string) => void }) {
  const cells: { label: string; field: FractionField; value: number | string; options: readonly (number | string)[] }[] = [
    { label: "左の分子", field: "leftNum", value: params.left.num, options: FRACTION_NUMS },
    { label: "左の分母", field: "leftDen", value: params.left.den, options: FRACTION_DENS },
    { label: "記号", field: "op", value: params.op, options: ["+", "-"] },
    { label: "右の分子", field: "rightNum", value: params.right.num, options: FRACTION_NUMS },
    { label: "右の分母", field: "rightDen", value: params.right.den, options: FRACTION_DENS },
  ];
  return <>
    <thead><tr>{cells.map((cell) => <th key={cell.field} scope="col">{cell.label}</th>)}</tr></thead>
    <tbody><tr>{cells.map((cell) => <td key={cell.field}>
      <select aria-label={cell.label} value={cell.value} onChange={(event) => onEdit(cell.field, event.target.value)}>
        {cell.options.map((option) => <option key={option} value={option}>{option === "-" ? "－" : option === "+" ? "＋" : option}</option>)}
      </select>
    </td>)}</tr></tbody>
  </>;
}

type Step = "capture" | "lasso" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "capture", label: "撮る" },
  { id: "lasso", label: "囲む" },
  { id: "review", label: "確かめて配る" },
];

function StepBar({ current }: { current: Step }) {
  const index = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="teacher-print-steps" aria-label="すること">
      {STEPS.map((step, position) => (
        <li key={step.id} className={position < index ? "is-done" : position === index ? "is-now" : undefined} aria-current={position === index ? "step" : undefined}>
          <span className="teacher-print-steps__number">{position + 1}</span>{step.label}
        </li>
      ))}
    </ol>
  );
}

export function PrintHandoutPage() {
  // 承認キーは画面の上の行（TeacherApproverKey）で 1 回だけ入れる
  const key = useApproverKey();
  // 学級に入っているときは、Cookie（同じ origin なので fetch にそのまま付く）で通るので、承認キーは要らない
  const inWorkspace = useTeacherSession().session.workspace !== undefined;
  const [problems, setProblems] = useState<ReadProblem[]>([]);
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState<string | null>(null);
  const [unsupportedCount, setUnsupportedCount] = useState(0);
  const [verified, setVerified] = useState<boolean[]>([]);
  const [photo, setPhoto] = useState<{ url: string; width: number; height: number; image: ImageBitmap } | null>(null);
  const [path, setPath] = useState<Point[]>([]);
  const [items, setItems] = useState<PrintHandout[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareScript, setShareScript] = useState<"loading" | "ready" | "failed">("loading");
  const headers: Record<string, string> = key.trim() ? { "x-approver-key": key } : {};
  const [listError, setListError] = useState(false);
  // 「取り下げる」は、確認の枠を出してから送る（#374。D-11 と同じ形）
  const [pendingWithdraw, setPendingWithdraw] = useState<string | null>(null);
  // 失敗（429・5xx・items 無し）のときは、一覧を前の値のままにして、読みこめなかったことを出す
  const refresh = () => fetch(`${apiBase}/api/v1/print/handouts`)
    .then(async (response) => {
      if (!response.ok) throw new Error();
      const body = await response.json() as { items?: PrintHandout[] };
      if (!Array.isArray(body.items)) throw new Error();
      setItems(body.items); setListError(false);
    })
    .catch(() => setListError(true));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${classroomShareScriptUrl}"]`);
    const handleLoad = () => {
      if (script) script.dataset.loaded = "true";
      setShareScript("ready");
    };
    const handleError = () => setShareScript("failed");
    if (script?.dataset.loaded === "true") {
      handleLoad();
      return;
    }
    if (!script) {
      script = document.createElement("script");
      script.src = classroomShareScriptUrl;
      script.async = true;
    }
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    if (!script.isConnected) document.head.append(script);
    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);
  useEffect(() => () => { if (photo) { URL.revokeObjectURL(photo.url); photo.image.close(); } }, [photo]);
  useEffect(() => () => { if (reviewPhotoUrl) URL.revokeObjectURL(reviewPhotoUrl); }, [reviewPhotoUrl]);
  async function pick(file?: File) {
    if (!file) return;
    if (photo) { URL.revokeObjectURL(photo.url); photo.image.close(); }
    const url = URL.createObjectURL(file);
    try {
      const image = await createImageBitmap(file);
      setPhoto({ url, image, width: image.width, height: image.height }); setPath([]); setProblems([]); setReviewPhotoUrl(null); setUnsupportedCount(0);
    } catch { URL.revokeObjectURL(url); setMessage("写真を開けませんでした。もう一度撮ってください。"); }
  }
  async function read(useLasso: boolean) {
    if (!photo) return;
    const bounds = lassoBounds(path);
    if (useLasso && (path.length < 3 || isTooSmall(bounds, photo.width, photo.height))) { setMessage("問題のまわりを大きく囲んでください。"); return; }
    setBusy(true); setMessage("");
    let previewUrl: string | null = null;
    try {
      const cropped = useLasso ? await cropToLasso(photo.image, path) : await fullPhoto(photo.image);
      previewUrl = URL.createObjectURL(cropped);
      const form = new FormData(); form.append("image", cropped, "print.jpg");
      const response = await fetch(`${apiBase}/api/v1/print/read`, { method: "POST", headers, body: form });
      if (response.status === 401 || response.status === 403) {
        URL.revokeObjectURL(previewUrl); previewUrl = null;
        setMessage(inWorkspace ? WORKSPACE_COPY.sessionEnded : "承認キーが違うか、入っていません。画面の上の「承認キー」を確かめてください。");
        return;
      }
      if (response.status === 429) {
        URL.revokeObjectURL(previewUrl); previewUrl = null;
        setMessage(await rateLimitMessage(response));
        return;
      }
      if (response.status === 422) {
        const error = await errorOf(response);
        if (error.code === "PRINT_NOT_SUPPORTED") {
          URL.revokeObjectURL(previewUrl); previewUrl = null;
          setMessage(`${WORKSPACE_COPY.readNotSupported}${error.demandRecorded === true ? WORKSPACE_COPY.readNotSupportedCounted : ""}`);
          return;
        }
        throw new Error();
      }
      const body = await response.json() as PrintReadResponse;
      setUnsupportedCount(body.unsupportedCount);
      if (response.ok && !body.problems?.length) {
        URL.revokeObjectURL(previewUrl); previewUrl = null;
        setMessage(`この写真には、まだ動く説明がありません。対応していない問題が ${body.unsupportedCount} 問あります。どの単元かを数えて、クラスの画面に出します。`);
        return;
      }
      if (!response.ok) throw new Error();
      const recognized = body.problems;
      setProblems(recognized); setVerified(recognized.map((item) => item.templateId !== "sansu-fraction-addsub"));
      setPhoto(null); URL.revokeObjectURL(photo.url); photo.image.close(); setPath([]);
      setReviewPhotoUrl(previewUrl);
      previewUrl = null;
    } catch {
      // 読み取り処理の失敗理由を、画面の失敗文に置き換える
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setMessage("読みこめませんでした。写真を確かめて、もう一度お試しください。");
    }
    finally { setBusy(false); }
  }
  async function deliver() {
    const selected = problems.map((problem, index) => ({ problem, index })).filter(({ index }) => verified[index]);
    if (selected.length === 0) return;
    setBusy(true); setMessage("");
    try {
      const failed = new Set<number>();
      for (const { problem, index } of selected) {
        if (problem.templateId === "sansu-fraction-addsub" && fractionRangeReason(problem.params)) { failed.add(index); continue; }
        try {
          const response = await fetch(`${apiBase}/api/v1/print/handouts`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ templateId: problem.templateId, questionText: problem.questionText, params: problem.params }) });
          if (!response.ok) failed.add(index);
        } catch { failed.add(index); }
      }
      const delivered = selected.length - failed.size;
      setProblems(problems.filter((_, index) => failed.has(index)));
      setVerified(problems.filter((_, index) => failed.has(index)).map(() => false));
      await refresh();
      setMessage(failed.size > 0 ? `${delivered} 問を配りました。${failed.size} 問は配れませんでした` : `${delivered} 問を配りました`);
    } finally { setBusy(false); }
  }
  function editLever(index: number, field: "leftPos" | "leftG" | "rightPos", value: number) {
    setProblems((current) => current.map((problem, itemIndex) => {
      if (itemIndex !== index) return problem;
      if (problem.templateId !== "rika-lever") return problem;
      const params = {
        left: { pos: field === "leftPos" ? value : problem.params.left.pos, g: field === "leftG" ? value : problem.params.left.g },
        right: { pos: field === "rightPos" ? value : problem.params.right.pos },
      };
      return validLeverParams(params) ? { ...problem, params } : problem;
    }));
    setVerified((checked) => checked.map((value, itemIndex) => itemIndex === index ? false : value));
  }
  function editFraction(index: number, field: FractionField, value: string) {
    setProblems((current) => current.map((problem, itemIndex) => {
      if (itemIndex !== index) return problem;
      if (problem.templateId !== "sansu-fraction-addsub") return problem;
      const params = editedFraction(problem.params, field, value);
      return { ...problem, params, questionText: fractionExpression(params) };
    }));
    setVerified((checked) => checked.map((entry, itemIndex) => itemIndex === index ? false : entry));
  }
  async function withdraw(id: string) {
    setPendingWithdraw(null);
    const response = await fetch(`${apiBase}/api/v1/print/handouts/${encodeURIComponent(id)}`, { method: "DELETE", headers });
    if (response.ok) await refresh(); else setMessage(inWorkspace ? "取り下げられませんでした。もう一度ためしてください。" : "取り下げられませんでした。承認キーを確かめてください。");
  }
  const step: Step = problems.length ? "review" : photo ? "lasso" : "capture";
  return (
    <main className={`teacher-today teacher-today--print${problems.length ? " teacher-today--reviewing" : ""}`}>
      <TeacherNav current="print" />
      <header className="teacher-print-head">
        <h1>プリントから説明をつくる</h1>
        <StepBar current={step} />
      </header>
      {!key && !inWorkspace && <p className="teacher-print-note" role="status">読み取りと配るには、画面の上の「承認キー」が要ります。</p>}
      {step === "capture" && <section className="teacher-print-capture" aria-label="写真を用意する">
        <p>説明したい問題が写るように、プリントを撮ります。写真は保存しません。</p>
        <label className="teacher-print-capture__camera button button--primary">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 10h6l3-4h6l3 4h6v16H4z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="16" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
          プリントを撮る
          <input className="teacher-print-capture__input" type="file" accept="image/*" capture="environment" onChange={(event) => void pick(event.currentTarget.files?.[0])} />
        </label>
        <label className="teacher-print-capture__library button button--secondary">
          写真から選ぶ
          <input className="teacher-print-capture__input" type="file" accept="image/*" onChange={(event) => void pick(event.currentTarget.files?.[0])} />
        </label>
      </section>}
      {photo && <section className="teacher-print-lasso" aria-label="写真の読み取り">
        <img className="teacher-print-source-photo" src={photo.url} alt="選んだプリントの写真" />
        <div className="teacher-print-actions">
          <Button variant="secondary" onClick={() => { URL.revokeObjectURL(photo.url); photo.image.close(); setPhoto(null); setPath([]); }}>撮りなおす</Button>
          <Button variant="primary" onClick={() => void read(false)}>{FULL_PHOTO_LABEL}</Button>
        </div>
        <details className="teacher-print-lasso__optional"><summary>{LASSO_PHOTO_LABEL}</summary>
        <LassoFrame src={photo.url} width={photo.width} height={photo.height} path={path} onPathChange={setPath} label="問題を囲む" description="問題のまわりを指かペンで囲みます。Enter キーで四角に囲めます。" />
        <div className="teacher-print-actions">
          <Button variant="primary" onClick={() => void read(true)}>囲んだ問題を読み取る</Button>
        </div>
        </details>
      </section>}
      {busy && <p className="teacher-print-note" role="status">読みこんでいます…</p>}
      {message && <p className="teacher-print-note teacher-print-note--message" role="status">{message}</p>}
      {problems.length > 0 && <section className="teacher-print-review" aria-label="読み取りの確認">
        <div className="teacher-print-review__photo"><img src={reviewPhotoUrl ?? ""} alt="読み取った問題の写真" /></div>
        <div className="teacher-print-review__details teacher-print-review__results">
          {unsupportedCount > 0 && <p className="teacher-print-note" role="status">対応していない問題が {unsupportedCount} 問あります。</p>}
          {problems.map((problem, index) => <article className="teacher-print-problem" key={`${index}-${problem.templateId}`}>
            <h3>{problem.templateId === "rika-lever" ? "てこ" : problem.templateId === "rika-moon" ? "月" : "分数"}</h3>
            <p className="teacher-print-problem__text">{problem.questionText}</p>
            {problem.templateId === "sansu-fraction-addsub" ? <><p className="teacher-print-review__expression" aria-label="読み取った式">{fractionExpression(problem.params)}</p><table aria-label="写真と見比べてください" className="teacher-print-review__table teacher-print-review__table--fraction"><caption>写真と見比べてください</caption><FractionRows params={problem.params} onEdit={(field, value) => editFraction(index, field, value)} /></table>{fractionRangeReason(problem.params) && <p className="teacher-print-note teacher-print-note--message" role="alert">この式は配れません。{fractionRangeReason(problem.params)}</p>}</> : problem.templateId === "rika-lever" ? <table aria-label="写真と見比べてください" className="teacher-print-review__table"><caption>写真と見比べてください</caption><tbody>
              <tr><th>左の目もり</th><td><select aria-label={index === 0 ? "左の目もり" : `${index + 1}問目 左の目もり`} value={problem.params.left.pos} onChange={(event) => editLever(index, "leftPos", Number(event.target.value))}>{leverChoices(problem.params, "leftPos").map((value) => <option key={value}>{value}</option>)}</select></td></tr>
              <tr><th>左の重さ</th><td><select aria-label={index === 0 ? "左の重さ" : `${index + 1}問目 左の重さ`} value={problem.params.left.g} onChange={(event) => editLever(index, "leftG", Number(event.target.value))}>{leverChoices(problem.params, "leftG").map((value) => <option key={value} value={value}>{value}g</option>)}</select></td></tr>
              <tr><th>右の目もり</th><td><select aria-label={index === 0 ? "右の目もり" : `${index + 1}問目 右の目もり`} value={problem.params.right.pos} onChange={(event) => editLever(index, "rightPos", Number(event.target.value))}>{leverChoices(problem.params, "rightPos").map((value) => <option key={value}>{value}</option>)}</select></td></tr>
            </tbody></table> : <><table aria-label="写真と見比べてください" className="teacher-print-review__table"><caption>写真と見比べてください</caption><tbody><tr><td colSpan={2}>この型には数がありません</td></tr></tbody></table></>}
            {problem.templateId === "sansu-fraction-addsub" ? <p className="teacher-print-note">{FRACTION_REVIEW_NOTE}</p> : <ExplainCard problem={problem} onRetake={() => {}} />}
            <label className="teacher-print-review__confirm"><input type="checkbox" checked={Boolean(verified[index])} onChange={(event) => setVerified((current) => current.map((checked, i) => i === index ? event.target.checked : checked))} />写真と数を確かめました</label>
          </article>)}
          <div className="teacher-print-actions teacher-print-actions--deliver"><Button variant="primary" disabled={!verified.some(Boolean) || busy} aria-disabled={!verified.some(Boolean) || busy} onClick={() => { if (!busy) void deliver(); }}>確かめた {verified.filter(Boolean).length} 問を配る</Button></div>
        </div>
      </section>}
      {problems.length === 0 && <section className="teacher-print-list" aria-labelledby="teacher-print-list-title">
        <div className="teacher-print-list__head">
          <h2 id="teacher-print-list-title">配った説明</h2>
          <Button variant="quiet" className="teacher-print-head__print" onClick={() => window.print()}>{STUDIO_COPY.print}</Button>
        </div>
        {listError && <div className="teacher-print-note teacher-print-note--message" role="alert">
          <p>配った説明を読みこめませんでした。</p>
          <Button variant="secondary" onClick={() => void refresh()}>もう一度読みこむ</Button>
        </div>}
        {items.length === 0 ? (listError ? null : <p className="teacher-print-note">まだ配っていません。</p>) : <ul>{items.map((item) => {
          const url = handoutUrl(item.id);
          return <li key={item.id} className="teacher-print-list__item">
            <p className="teacher-print-list__text">{item.questionText}</p>
            {item.origin === "child" ? <p className="teacher-print-note">{WORKSPACE_COPY.childMark}</p> : null}
            <a className="teacher-print-list__link" href={url} target="_blank" rel="noreferrer">子どもの画面で開く</a>
            <div className="teacher-print-list__actions">
              {shareScript !== "failed" ? <div className="g-sharetoclassroom" data-url={url} data-size="32" aria-label="Classroom で共有" title="Classroom で共有" /> : null}
              {shareScript === "failed" ? <a className="button button--secondary" href={classroomFallbackUrl(url)} target="_blank" rel="noreferrer">Classroom で共有</a> : null}
              <Button variant="quiet" onClick={() => setPendingWithdraw(item.id)}>{HANDOUT_WITHDRAW_COPY.withdraw}</Button>
            </div>
            {pendingWithdraw === item.id && <div className="teacher-print-list__confirm" role="group" aria-label={HANDOUT_WITHDRAW_COPY.withdraw}>
              <p>{HANDOUT_WITHDRAW_COPY.confirm(item.questionText)}</p>
              <div className="teacher-print-list__actions">
                <Button variant="secondary" onClick={() => void withdraw(item.id)}>{HANDOUT_WITHDRAW_COPY.withdraw}</Button>
                <Button variant="text" onClick={() => setPendingWithdraw(null)}>{HANDOUT_WITHDRAW_COPY.cancel}</Button>
              </div>
            </div>}
          </li>;
        })}</ul>}
      </section>}
      {problems.length === 0 && !photo && <PrintDemandPanel />}
    </main>
  );
}
