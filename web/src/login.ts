// 子どものログイン（D-145、D-146、D-148）。
// 本物のログイン（Google・Microsoft、サーバのセッション）は持ち主の承認（UI の Q-37、Q-38）の後に入れる。
// それまでは仮の動き：ボタンを押すとこの端末でログインしたことにし、名前とメールは架空の物を出す。
// 端末に置くのは「どの会社でログインしたか」だけで、名前もメールも保存しない（05_screens の保存する値）
import { useSyncExternalStore } from "react";

export type LoginProvider = "Google" | "Microsoft";

export interface LoginAccount {
  provider: LoginProvider;
  /** 先生の名簿の名前（CP-781）。仮は架空の名前 */
  name: string;
  /** ログインのメール（CP-795）。仮は架空のメール */
  email: string;
}

export const LOGIN_KEY = "sugoroku:login-mock";
// 架空の名前とメール（変更レポートの Q-37「それまでは架空の名前とメール」）
export const MOCK_NAME = "さとう ひなた";
export const MOCK_EMAIL = "hinata.sato@example.ed.jp";

const CHANGE = "sugoroku:loginchange";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readProvider(): LoginProvider | null {
  try {
    const raw = storage()?.getItem(LOGIN_KEY);
    return raw === "Google" || raw === "Microsoft" ? raw : null;
  } catch {
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE));
}

/** ログインしているか。読めない・壊れた値はログインしていない扱い */
export function isLoggedIn(): boolean {
  return readProvider() !== null;
}

/** 今ログインしているアカウント。していなければ null */
export function currentAccount(): LoginAccount | null {
  const provider = readProvider();
  return provider === null ? null : { provider, name: MOCK_NAME, email: MOCK_EMAIL };
}

/** 仮のログイン。本物ではここで会社のログインの画面へ移る。保存できなければ false */
export function logIn(provider: LoginProvider): boolean {
  try {
    storage()?.setItem(LOGIN_KEY, provider);
  } catch {
    return false;
  }
  notify();
  return readProvider() === provider;
}

/** ログアウト。消せなければ false（CP-792 を出す） */
export function logOut(): boolean {
  try {
    storage()?.removeItem(LOGIN_KEY);
  } catch {
    return false;
  }
  notify();
  return readProvider() === null;
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE, callback);
    window.removeEventListener("storage", callback);
  };
}

/** ログインしているかを画面で読む。ほかのタブでログアウトした時も変わる */
export function useLoggedIn(): boolean {
  return useSyncExternalStore(subscribe, isLoggedIn, () => false);
}
