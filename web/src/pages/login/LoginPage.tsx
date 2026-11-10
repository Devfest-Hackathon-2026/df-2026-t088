import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { COPY } from "../../copy";
import { useText } from "../../grade";
import { logIn } from "../../login";
import type { LoginProvider } from "../../login";
import "./LoginPage.css";

// ロゴは各社の決まりの色なので、色のトークンを使わない（D-145）。手描きにせず、決まりの形をそのまま置く
function GoogleLogo() {
  return (
    <svg className="login__logo" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg className="login__logo" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

interface LoginPageProps {
  /** ログインできた時。App は /home へ置き換えて移す（戻るでこの画面に戻らない） */
  onLoggedIn: () => void;
  /** 先生に登録されていない状態から始める（入れたメール）。仮の動きでは起きないので、テストが出す */
  unregisteredEmail?: string;
}

/** PG-009 ログイン（D-145、D-146、D-153）。先生の画面への入口は置かない（先生は /teacher/ を直接開く）。3D も学年の教科も待たない（D-139）。仮の動き：押すとこの端末でログインしたことにする */
export function LoginPage({ onLoggedIn, unregisteredEmail }: LoginPageProps) {
  const t = useText();
  const [failed, setFailed] = useState(false);
  const [unregistered, setUnregistered] = useState<string | null>(unregisteredEmail ?? null);

  const start = (provider: LoginProvider) => {
    if (logIn(provider)) {
      setFailed(false);
      onLoggedIn();
    } else {
      setFailed(true);
    }
  };

  let body: ReactNode;
  if (unregistered !== null) {
    body = (
      <div className="login__unregistered">
        {/* 最初の focus は置かない（D-153）。代わりに出た時に読み上げる */}
        <p className="login__notice" role="status">{t(COPY.CP_789)}</p>
        <p className="login__email">{t(COPY.CP_790(unregistered))}</p>
        <Button variant="secondary" onClick={() => { setUnregistered(null); setFailed(false); }}>{t(COPY.CP_791)}</Button>
      </div>
    );
  } else {
    body = (
      <>
        {failed && <p className="login__failed" role="status">{t(COPY.CP_792)}</p>}
        <div className="login__buttons">
          {/* 最初の focus は置かない（D-153）。autoFocus にも :focus-visible が当たり、開いた直後にボタンの外へ枠が二重に出ていた */}
          <Button variant="secondary" se="enter" className="login__provider" onClick={() => start("Google")}>
            <GoogleLogo />{t(COPY.CP_786)}
          </Button>
          <Button variant="secondary" se="enter" className="login__provider" onClick={() => start("Microsoft")}>
            <MicrosoftLogo />{t(COPY.CP_787)}
          </Button>
        </div>
      </>
    );
  }

  return (
    <main className="login">
      <h1 className="login__title">{t(COPY.CP_780)}</h1>
      <p className="login__lead">{t(COPY.CP_785)}</p>
      {body}
    </main>
  );
}
