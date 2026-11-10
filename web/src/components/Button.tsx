import type { ButtonHTMLAttributes, MouseEvent } from "react";
import type { SeKind } from "../audio/se";
import { playSe } from "../audio/use-bgm";
import "./Button.css";

// quiet は secondary を一段小さくした札（CMP-001、D-128、D-149）
export type ButtonVariant = "primary" | "secondary" | "text" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 押した時の効果音（D-104）。既定は選ぶ音。決定は "enter"。結果の音や戻る音が別に鳴る所は null */
  se?: SeKind | null;
}

// disabled は使わない（CMP-001）。条件は押した後の文で伝える
export function Button({ variant = "secondary", className, type = "button", se = "select", onClick, ...rest }: ButtonProps) {
  const classes = ["button", `button--${variant}`, className].filter(Boolean).join(" ");
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (se) playSe(se);
    onClick?.(event);
  };
  return <button type={type} className={classes} onClick={handleClick} {...rest} />;
}
