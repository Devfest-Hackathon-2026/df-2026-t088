// プリント撮影の API の呼び出し（契約書「プリント撮影の API」）。サーバができるまでは見本を返す
import { expressionMatches, fractionRangeReason, readFractionParams } from "./fraction-addsub";
import type { PrintErrorKind, PrintReadResponse, ReadProblem } from "./types";
import fractionMock from "./mocks/fraction.json";
import okMock from "./mocks/ok.json";
import partialMock from "./mocks/partial.json";
import unreadableMock from "./mocks/unreadable.json";
import unsupportedMock from "./mocks/unsupported.json";

const apiBase = (import.meta.env.VITE_LOOP_API_URL as string | undefined) ?? "";
/** AI の待ちは最悪で約 30 秒。フロントは 40 秒で止める */
export const CLIENT_TIMEOUT_MS = 40_000;
export const MOCK_DELAY_MS = 1_200;
const MAX_PROBLEMS = 6;
const MAX_QUESTION_LENGTH = 200;

/** 画面の文とボタンを決める失敗。呼び出し側が止めた時（AbortError）はこれにしない */
export class PrintReadError extends Error {
  constructor(readonly kind: PrintErrorKind, readonly demandRecorded = false) {
    super(kind);
    this.name = "PrintReadError";
  }
}

const KIND_BY_CODE: Record<string, PrintErrorKind> = {
  PRINT_UNREADABLE: "unreadable",
  IMAGE_INVALID: "unreadable",
  PRINT_NOT_SUPPORTED: "not-supported",
  TIMEOUT: "timeout",
  RATE_LIMITED: "rate",
};

/** error.code から失敗の種類を決める。知らない code は unavailable */
export function kindFromCode(code: unknown): PrintErrorKind {
  return (typeof code === "string" && KIND_BY_CODE[code]) || "unavailable";
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isInt = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/** 1問が契約書の範囲に合っていれば、型の付いた問題にして返す。合わなければ null */
function validateProblem(raw: unknown): ReadProblem | null {
  if (!isObject(raw)) return null;
  const { templateId, questionText, params, approved } = raw;
  const handoutId = typeof raw.handoutId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.handoutId) ? { handoutId: raw.handoutId } : {};
  if (typeof questionText !== "string" || questionText.length === 0 || questionText.length > MAX_QUESTION_LENGTH) return null;
  if (typeof approved !== "boolean" || !isObject(params)) return null;
  if (templateId === "rika-moon") return { templateId, questionText, params: {}, approved, ...handoutId };
  if (templateId === "rika-lever") {
    const left = params.left;
    const right = params.right;
    if (!isObject(left) || !isObject(right)) return null;
    const { pos: leftPos, g } = left;
    const rightPos = right.pos;
    if (!isInt(leftPos, 1, 6) || !isInt(rightPos, 1, 6) || !isInt(g, 10, 100) || g % 10 !== 0) return null;
    const answer = (g * leftPos) / rightPos;
    if (!Number.isInteger(answer) || answer < 10 || answer > 100 || answer % 10 !== 0) return null;
    return { templateId, questionText, params: { left: { pos: leftPos, g }, right: { pos: rightPos } }, approved, ...handoutId };
  }
  if (templateId === "sansu-fraction-addsub") {
    const fraction = readFractionParams(params);
    if (!fraction || fractionRangeReason(fraction) !== null || !expressionMatches(questionText, fraction)) return null;
    return { templateId, questionText, params: fraction, approved };
  }
  return null;
}

/** 成功の応答を確かめる。合わない問題は落として unsupportedCount に足し、全部落ちたら not-supported */
export function validateReadResponse(body: unknown): PrintReadResponse {
  if (!isObject(body) || !Array.isArray(body.problems)) throw new PrintReadError("unavailable");
  const count = body.unsupportedCount;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) throw new PrintReadError("unavailable");
  const valid = body.problems.map(validateProblem).filter((p): p is ReadProblem => p !== null);
  const kept = valid.slice(0, MAX_PROBLEMS);
  if (kept.length === 0) throw new PrintReadError("not-supported");
  return { problems: kept, unsupportedCount: count + (body.problems.length - kept.length), demandRecorded: body.demandRecorded === true };
}

/** 本文を読む。error があれば失敗にし、無ければ成功として確かめる */
function interpret(body: unknown, httpOk: boolean, classCode?: string): PrintReadResponse {
  if (isObject(body) && isObject(body.error)) {
    const { code, scope } = body.error;
    // 学級コードで撮ったときの 401 は、学級が切っているということ。回数の上限は、今日の分か、少し待てば直るものかを分ける
    const kind = classCode !== undefined && code === "UNAUTHORIZED" ? "closed" : code === "RATE_LIMITED" && scope === "day" ? "daily" : kindFromCode(code);
    throw new PrintReadError(kind, body.error.demandRecorded === true);
  }
  if (!httpOk) throw new PrintReadError("unavailable");
  return validateReadResponse(body);
}

const MOCKS: Record<string, unknown> = {
  ok: okMock,
  fraction: fractionMock,
  partial: partialMock,
  unreadable: unreadableMock,
  unsupported: unsupportedMock,
  // busy は JSON を置かず、AI_UNAVAILABLE として扱う
  busy: { error: { code: "AI_UNAVAILABLE", message: "" } },
};

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readMock(signal: AbortSignal): Promise<PrintReadResponse> {
  await wait(MOCK_DELAY_MS, signal);
  const name = new URLSearchParams(window.location.search).get("print-mock") ?? "ok";
  return interpret(MOCKS[name] ?? MOCKS.ok, true);
}

async function readApi(image: Blob, signal: AbortSignal, classCode?: string): Promise<PrintReadResponse> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new PrintReadError("offline");
  const form = new FormData();
  form.append("image", image, "print.jpg");
  // 学級コードで入った子どもの撮影。先生の承認キーや Cookie の代わりに、学級コードを付ける
  const response = await fetch(`${apiBase}/api/v1/print/read`, { method: "POST", body: form, signal, ...(classCode === undefined ? {} : { headers: { "x-class-code": classCode } }) });
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PrintReadError("unavailable");
  }
  return interpret(body, response.ok, classCode);
}

/**
 * 本物の読み取り（VITE_PRINT_READ が "api"）の build か。違えば、撮る入口も PG-010 の道も出さない（見本の応答を公開に出さない。#281）
 */
export const printReadIsReal = (): boolean => import.meta.env.VITE_PRINT_READ === "api";

/**
 * 写真を送って、説明できる問題を受け取る。VITE_PRINT_READ が "api" の時だけ本当に送る。
 * 呼び出し側の signal で止めた時は AbortError を投げ直す。それ以外の失敗は PrintReadError
 */
export async function readPrint(image: Blob, signal?: AbortSignal, classCode?: string): Promise<PrintReadResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) throw abortError();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  try {
    return import.meta.env.VITE_PRINT_READ === "api" ? await readApi(image, controller.signal, classCode) : await readMock(controller.signal);
  } catch (error) {
    if (error instanceof PrintReadError) throw error;
    if (signal?.aborted) throw error instanceof DOMException && error.name === "AbortError" ? error : abortError();
    if (timedOut) throw new PrintReadError("timeout");
    throw new PrintReadError("offline");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
