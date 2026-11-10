import type { Notice } from "./use-loop";

/** 結果の文は、押した段の中に出す。いつも置いておくので、読み上げにも届く。失敗は色だけでなく、太字と線でも分かる（research.css） */
export function StepNotice({ notice, step }: { notice: Notice | null; step: number }) {
  const mine = notice?.step === step ? notice : null;
  return (
    <p className={mine?.isError ? "step__notice is-error" : "step__notice"} role="status" aria-live="polite">
      {mine?.text ?? ""}
    </p>
  );
}
