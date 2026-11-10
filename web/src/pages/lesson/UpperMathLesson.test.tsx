import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UPPER_MATH, upperMathSummary } from "../../lesson/upper-math";
import { UPPER_CONCEPTS } from "../../lesson/upper-concepts";
import { UpperMathLesson } from "./UpperMathLesson";

function answerBaseIfNeeded(visual: (typeof UPPER_MATH)[string]["main"][number]["practice"]["visual"]) {
  const baseArea = visual.kind === "volume" ? visual.width * visual.height
    : visual.kind === "prism" && visual.baseDimensions ? visual.baseArea : undefined;
  if (baseArea !== undefined) {
    fireEvent.change(screen.getByLabelText(/^底面積/), { target: { value: String(baseArea) } });
    fireEvent.click(screen.getByRole("button", { name: "底面積を答える" }));
  }
}

describe("4〜6年の学習", () => {
  it("反比例は人数と1人分の倍率を対応させ、xへの代入を案内する", () => {
    const question = UPPER_MATH["sansu-6-07"].main.find(({ practice }) => practice.title === "反比例の関係")!.practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(screen.getByRole("img", { name: "1人と2人を比べると×2" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "1人と2人を比べると÷2" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("img", { name: "1人と3人を比べると×3" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "1人と3人を比べると÷3" })).toBeTruthy();
    expect(screen.getByText(/x に 4 を入れて/)).toBeTruthy();
    expect(screen.getByText("24 ÷ 4")).toBeTruthy();
  });

  it("mLの比は単位と帯の区切り方を示す", () => {
    const question = UPPER_MATH["sansu-6-08"].main[0].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText("1 L ＝ 1000 mL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText(/100mL を1つ分として/)).toBeTruthy();
  });

  it("平均は数値の答えを先に表示せず、同じ高さにならす動きで考える", () => {
    const question = UPPER_MATH.average.main[0].practice;
    const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    const heights = () => [...view.container.querySelectorAll<HTMLElement>(".upper__bar")].map((bar) => bar.style.height);
    expect(new Set(heights()).size).toBe(3);
    expect(screen.getByRole("button", { name: "平均の説明を見る" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(new Set(heights()).size).toBe(1);
    expect(screen.queryByText("4冊")).toBeNull();
    expect(view.container.querySelector("form")!.compareDocumentPosition(view.container.querySelector(".upper__guide")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("問題から説明を開いて戻っても入力を保つ", () => {
    const question = UPPER_MATH.integer.main[1].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(question.problem)).toBeTruthy();
    const input = screen.getByLabelText(/^答え/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "はい" } });
    fireEvent.click(screen.getByRole("button", { name: "約数の説明を見る" }));
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect((screen.getByLabelText(/^答え/) as HTMLInputElement).value).toBe("はい");
  });
  it("約数を別の数で学び、問いとヒントを分けて進める", () => {
    const question = UPPER_MATH.integer.main[1].practice;
    const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(question.problem)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "約数の説明を見る" }));
    expect(screen.getByRole("heading", { name: "約数を知ろう" })).toBeTruthy();
    expect(screen.queryByText(question.problem)).toBeNull();
    expect(view.container.querySelectorAll(".upper__collection-items span")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(view.container.querySelectorAll(".upper__collection-group")).toHaveLength(3);
    expect(screen.getByText("6 ÷ 2 ＝ 3 あまり 0")).toBeTruthy();
    expect(screen.getByText(/6をあまりなく割れる2/).tagName).toBe("MARK");
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText("6 ÷ 4 ＝ 1 あまり 2")).toBeTruthy();
    expect(screen.getByText(/4は、6の約数ではありません/)).toBeTruthy();
    expect(view.container.querySelector(".upper__collection-group.is-remainder")?.querySelectorAll("span")).toHaveLength(2);
    expect(screen.queryByText(question.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect(screen.getByText(question.problem)).toBeTruthy();
    expect(view.container.querySelectorAll(".upper__collection-group")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(screen.getByText(/12こを3こずつ/)).toBeTruthy();
    expect(view.container.querySelectorAll(".upper__collection-group")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "約数の説明を見る" }));
    expect(screen.getByRole("heading", { name: "約数を知ろう" })).toBeTruthy();
  });
  it("導入を設けた用語は練習前に見られ、章末テストでは出題を妨げない", () => {
    for (const [title, concept] of Object.entries(UPPER_CONCEPTS)) {
      const questions = Object.values(UPPER_MATH).flatMap((chapter) => [...chapter.main.map((entry) => entry.practice), ...Object.values(chapter.sides ?? {})]);
      const match = questions.find((entry) => entry.title === title);
      expect(match, title).toBeDefined();
      const view = render(<UpperMathLesson practice={match!} onExit={vi.fn()} onFinish={vi.fn()} />);
      expect(screen.getByText(match!.problem)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: `${concept.name}の説明を見る` }));
      expect(screen.getByRole("heading", { name: `${concept.name}を知ろう` })).toBeTruthy();
      expect(screen.queryByText(match!.problem)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
      expect(screen.getByText(match!.problem)).toBeTruthy();
      view.unmount();
    }
    const { practice, test } = UPPER_MATH.integer.main[1];
    render(<UpperMathLesson practice={practice} summary={[test]} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(test.problem)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "約数を知ろう" })).toBeNull();
  });
  it("全練習とまとめの答えを入力できる", () => {
    for (const chapter of Object.values(UPPER_MATH)) for (const item of chapter.main) for (const question of [item.practice, item.test]) {
      const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
      const skipIntro = screen.queryByRole("button", { name: "問題にすすむ" });
      if (skipIntro) fireEvent.click(skipIntro);
      answerBaseIfNeeded(question.visual);
      if (question.answerFormat === "fraction") {
        const [numerator, denominator = "1"] = question.answer.split("/");
        fireEvent.change(screen.getByLabelText("答えの分子"), { target: { value: numerator } });
        fireEvent.change(screen.getByLabelText("答えの分母"), { target: { value: denominator } });
      } else {
        fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: question.answer } });
      }
      fireEvent.click(screen.getByRole("button", { name: "答える" }));
      expect(screen.getByText(question.explanation)).toBeTruthy();
      view.unmount();
    }
  });
  it("用意した寄り道の答えも入力できる", () => {
    for (const chapter of Object.values(UPPER_MATH)) for (const question of Object.values(chapter.sides ?? {})) {
      const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
      const intro = screen.queryByRole("button", { name: "問題にすすむ" });
      if (intro) fireEvent.click(intro);
      answerBaseIfNeeded(question.visual);
      fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: question.answer } });
      fireEvent.click(screen.getByRole("button", { name: "答える" }));
      expect(screen.getByText(question.explanation)).toBeTruthy();
      view.unmount();
    }
  });
  it("面積の図を段階的に区切り、誤答時に入力を残す", () => {
    const question = UPPER_MATH["sansu-4-12"].main[1].practice;
    const { container } = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(container.querySelectorAll(".upper__grid span.is-unit")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(container.querySelectorAll(".upper__grid span.is-unit")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(container.querySelectorAll(".upper__grid span.is-unit")).toHaveLength(15);
    expect(screen.queryByText("15cm²")).toBeNull();
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    expect((screen.getByLabelText(/^答え/) as HTMLInputElement).value).toBe("8");
    expect(screen.getByRole("status").textContent).toContain("列");
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "１５ｃｍ²" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    expect(screen.getByText(question.explanation)).toBeTruthy();
  });
  it("体積は1段から全ての段へ、比は同じ幅へ分けて考える", () => {
    const volume = UPPER_MATH.volume.main[2].practice;
    const view = render(<UpperMathLesson practice={volume} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: /横3cm/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(screen.getAllByRole("img", { name: /の1段/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getAllByRole("img", { name: /の1段/ })).toHaveLength(2);
    view.unmount();
    const ratio = UPPER_MATH["sansu-6-08"].main[0].practice;
    const ratioView = render(<UpperMathLesson practice={ratio} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText(/100mL ずつ/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "３：２" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    expect(screen.getByText(ratio.explanation)).toBeTruthy();
    ratioView.unmount();
  });
  it("まとめは別の問題を順に終えて完了する", () => {
    const questions = upperMathSummary("sansu-4-01");
    const finish = vi.fn();
    render(<UpperMathLesson practice={questions[0]} summary={questions} onExit={vi.fn()} onFinish={finish} />);
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "43,000" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    fireEvent.click(screen.getByRole("button", { name: "つぎの問題へ" }));
    expect(finish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "340000000" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    fireEvent.click(screen.getByRole("button", { name: "ばんめんにもどる" }));
    expect(finish).toHaveBeenCalledOnce();
  });
  it("奇数の組分けと、公倍数を比較できる", () => {
    const odd = UPPER_MATH.integer.main[0].practice;
    const view = render(<UpperMathLesson practice={odd} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    const groups = view.container.querySelectorAll(".upper__collection-group");
    expect(groups).toHaveLength(4);
    expect(groups[3].querySelectorAll("span")).toHaveLength(1);
    expect(groups[3].textContent).toContain("あまり");
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "きすう" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    expect(screen.getByText(odd.explanation)).toBeTruthy();
    view.unmount();
    const multiple = UPPER_MATH.integer.main[4].practice;
    const next = render(<UpperMathLesson practice={multiple} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    const common = [...next.container.querySelectorAll(".upper__number-list .is-common")].map((node) => node.textContent);
    expect(common).toEqual(["6", "12", "6", "12"]);
  });
  it("偶数と奇数を4こと5この具体例から説明してから問題に進む", () => {
    const odd = UPPER_MATH.integer.main[0].practice;
    const view = render(<UpperMathLesson practice={odd} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(odd.problem)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "偶数と奇数の説明を見る" }));
    expect(screen.getByRole("heading", { name: "偶数と奇数を知ろう" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "おはじきが4こある図" })).toBeTruthy();
    expect(screen.queryByText(odd.problem)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "2こずつ組にする" }));
    expect(view.container.querySelectorAll(".parity__pair")).toHaveLength(2);
    expect(screen.getByText(/あまりなし → 偶数/)).toBeTruthy();
    expect(screen.getByText(/2で割り切れる数を偶数/).tagName).toBe("MARK");
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByRole("img", { name: "おはじきが5こある図" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2こずつ組にする" }));
    expect(view.container.querySelectorAll(".parity__pair.is-leftover")).toHaveLength(1);
    expect(screen.getByText(/1こあまる → 奇数/)).toBeTruthy();
    expect(screen.getByText(/2で割ると1あまる数を奇数/).tagName).toBe("MARK");
    expect(screen.queryByText(odd.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect(screen.getByText(odd.problem)).toBeTruthy();
    expect(screen.queryByText(odd.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "偶数と奇数の説明を見る" }));
    expect(screen.getByRole("heading", { name: "偶数と奇数を知ろう" })).toBeTruthy();
  });
  it("面積は変形の過程を順に示し、答えは入力まで表示しない", () => {
    const question = UPPER_MATH.area.main[0].practice;
    const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(view.container.querySelector(".upper__area-moved")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(view.container.querySelector(".upper__area-cut")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(view.container.querySelector(".upper__area-moved")).toBeTruthy();
    expect(screen.queryByText(question.explanation)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "もどる" }));
    expect(view.container.querySelector(".upper__area-moved")).toBeNull();
  });
  it("比例の表で増え方を示し、求める値は隠す", () => {
    const question = UPPER_MATH["sansu-6-07"].main[0].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("table", { name: "数量の対応を示す表" })).toBeTruthy();
    expect(screen.queryByText("480")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(screen.getByRole("img", { name: "1つ増えるごとに+120円" })).toBeTruthy();
    expect(screen.queryByText("480")).toBeNull();
  });
  it("円を分けて並べる流れを示し、求める面積は伏せる", () => {
    const question = UPPER_MATH["sansu-6-05"].main[0].practice;
    const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: "半径2cmの円" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /交互に並べた/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(view.container.querySelectorAll(".upper__circle-area > div:first-child .upper__sector-piece")).toHaveLength(16);
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByRole("img", { name: /交互に並べた/ }).querySelectorAll(".upper__sector-piece")).toHaveLength(16);
    expect(screen.queryByText("12.56cm²")).toBeNull();
  });
  it("割合は全体100％と残りを区切り、途中の割合だけを段階的に出す", () => {
    const question = UPPER_MATH.ratio.main[2].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText("全体 80ページ ＝ 100％")).toBeTruthy();
    expect(screen.queryByText("残り 75％")).toBeNull();
    expect(screen.queryByText("60ページ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(screen.getByText("残り 75％")).toBeTruthy();
    expect(screen.queryByText("60ページ")).toBeNull();
  });
  it("百分率を学ぶ前の割合は、全体を1として表す", () => {
    const question = UPPER_MATH.ratio.main[0].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(question.problem)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "割合の説明を見る" }));
    expect(screen.getByText("全体 8こ ＝ 1")).toBeTruthy();
    expect(screen.queryByText(/100％/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect(screen.getByText("全体 20こ ＝ 1")).toBeTruthy();
    expect(screen.queryByText(/100％/)).toBeNull();
  });
  it("1あたりの量は全体を等分して考えられる", () => {
    const question = UPPER_MATH.unit.main[0].practice;
    const view = render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(view.container.querySelectorAll(".upper__split-fill span")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "図を使って考える" }));
    expect(view.container.querySelectorAll(".upper__split-fill span")).toHaveLength(5);
    expect(screen.queryByText("100mL")).toBeNull();
  });
  it("速さはkm/hの単位付きでも答えられる", () => {
    const question = UPPER_MATH.unit.main[3].practice;
    render(<UpperMathLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: "４ km/h" } });
    fireEvent.click(screen.getByRole("button", { name: "答える" }));
    expect(screen.getByText(question.explanation)).toBeTruthy();
  });
});
