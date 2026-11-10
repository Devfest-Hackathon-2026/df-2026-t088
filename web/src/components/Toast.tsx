import { useRef } from "react";
import type { ToastMessage } from "../game/use-game";
import { useText } from "../grade";
import "./Toast.css";

// 消える間も文字が残るよう、最後の文を覚えておく。role="status" は最初から置く（出す前に無いと読み上げられない）
export function Toast({ toast }: { toast: ToastMessage | null }) {
  const t = useText();
  const lastText = useRef("");
  if (toast) lastText.current = toast.text;
  return (
    <p className={`toast${toast ? " is-shown" : ""}`} role="status">
      {t(toast ? toast.text : lastText.current)}
    </p>
  );
}
