import type { ComponentProps } from "react";
import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";

interface LessonButtonProps extends Omit<ComponentProps<typeof Button>, "children"> {
  /** ふりがな記法つき */
  text: string;
}

/** ふりがなつきのボタン。読み上げの名前にふりがなを入れない */
export function LessonButton({ text, ...rest }: LessonButtonProps) {
  const t = useText();
  return <Button aria-label={t(text)} {...rest}><Ruby text={text} /></Button>;
}
