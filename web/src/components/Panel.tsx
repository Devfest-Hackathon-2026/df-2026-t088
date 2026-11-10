import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { playSe } from "../audio/use-bgm";
import "./Panel.css";

interface PanelProps {
  open: boolean;
  /** 閉じた時（Esc も含む）に呼ぶ。open を false にする */
  onClose: () => void;
  /** 見出しの id。dialog の名前になる */
  labelledBy: string;
  variant?: "normal" | "levelup" | "drawer" | "account";
  children: ReactNode;
}

// 開く時に押していた物を覚え、閉じたらそこへフォーカスを戻す。
// 開いた直後のフォーカスは dialog の仕様どおり（autofocus があればそこ、なければ最初の操作要素）
export function Panel({ open, onClose, labelledBy, variant = "normal", children }: PanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      triggerRef.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    onClose();
  };

  // 引き出しは覆い（dialog の外側）を押しても閉じる。dialog 自身の外を押した時だけ閉じる
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    // 覆いを押すと、dialog 自身が target になる。中の操作要素のクリックは対象外
    if ((variant !== "drawer" && variant !== "account") || event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    const isOutside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (isOutside) {
      playSe("select");
      event.currentTarget.close();
    }
  };

  return (
    <dialog ref={dialogRef} className={`panel panel--${variant}`} aria-labelledby={labelledBy} onClose={handleClose} onClick={handleClick}>
      {open ? children : null}
    </dialog>
  );
}
