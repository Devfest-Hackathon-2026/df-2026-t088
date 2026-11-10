// 画面を移ったら、その画面の見出し（h1。無ければ名前の付いた main）へフォーカスを移す（#371、WCAG 2.4.3）。
// 前の画面のボタンが消えるとフォーカスは body に落ち、キーボードの人は毎回 Tab を先頭から打ち直すことになる。
// 画面は遅れて出ることがあるので、見出しが出るまで数フレーム待つ。その間に別の所へフォーカスが置かれたら（「← ホーム」で戻った時の入口など）何もしない

const MAX_FRAMES = 60;

const isLost = (): boolean => {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected;
};

/** 見出しへ移す。戻り値は、待つのをやめる関数 */
export function focusPageHeading(): () => void {
  let frame = 0;
  let id = 0;
  const tick = () => {
    if (!isLost()) return;
    // 見出しが無い画面（島の地図。h1 は置かない）は、名前の付いた main へ
    const heading = document.querySelector<HTMLElement>("h1") ?? document.querySelector<HTMLElement>("main[aria-label]");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      return;
    }
    frame += 1;
    if (frame < MAX_FRAMES) id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
