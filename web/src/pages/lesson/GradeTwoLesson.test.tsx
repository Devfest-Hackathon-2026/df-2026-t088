import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GRADE_TWO_LESSONS } from "../../lesson/grade-two";
import { GradeTwoLesson } from "./GradeTwoLesson";

describe("2年生の学習", () => {
  it("10この束の中身を示し、束だけを順に数えて答えを伏せる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-01"][0].practice;
    const { container } = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(container.querySelectorAll(".grade-two__bundle")).toHaveLength(3);
    expect(container.querySelectorAll(".grade-two__dots span")).toHaveLength(30);
    const count = screen.getByRole("button", { name: "たばを 1つ 数える" });
    fireEvent.click(count);
    expect(screen.getAllByText(/ここまで 10こ/).length).toBeGreaterThan(0);
    fireEvent.click(count);
    expect(screen.getAllByText(/ここまで 20こ/).length).toBeGreaterThan(0);
    fireEvent.click(count);
    expect(screen.getByText(/たばは 30こ/)).toBeTruthy();
    expect(screen.queryByText(/34こ/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "こたえ" }), { target: { value: "３４こ" } });
    fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
    expect(screen.getByText(question.explanation)).toBeTruthy();
  });

  it("各問題の指定された答えを入力できる", () => {
    for (const lessons of Object.values(GRADE_TWO_LESSONS)) for (const lesson of lessons) for (const question of [lesson.practice, lesson.test]) {
      if (question.visual?.type === "make-ten") continue; // 専用の操作と答えは MakeTenLesson.test.tsx で確認する。
      const view = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
      const intro = screen.queryByRole("button", { name: "問題にすすむ" });
      if (intro) fireEvent.click(intro);
      if (question.visual?.type === "fraction-parts") {
        const [num, den] = question.answer.split("/");
        fireEvent.change(screen.getByLabelText("こたえの分子"), { target: { value: num } });
        fireEvent.change(screen.getByLabelText("こたえの分母"), { target: { value: den } });
      } else fireEvent.change(screen.getByRole("textbox", { name: "こたえ" }), { target: { value: question.answer } });
      fireEvent.click(screen.getByRole("button", { name: "こたえる" }));
      expect(screen.getByText(question.explanation)).toBeTruthy();
      view.unmount();
    }
  });

  it("ひっ算を位ごとの表で示し、くり上がりを段階的に見せる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-02"][0].practice;
    const { container } = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("columnheader", { name: "十のくらい" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "一のくらい" })).toBeTruthy();
    expect(screen.queryByText("42")).toBeNull();
    expect(screen.queryByRole("rowheader", { name: "くり上がり" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "ひっ算の やり方を見る" }));
    expect(screen.getByText(/一のくらいの 7 と 5/)).toBeTruthy();
    expect(container.querySelectorAll(".is-focused")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/7＋5＝12/)).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "くり上がり" }).nextElementSibling?.textContent).toBe("1");
    expect(screen.getByRole("rowheader", { name: "こたえ" }).parentElement?.textContent).toContain("□2");
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/十のくらいの 2 と 1/)).toBeTruthy();
    expect(screen.queryByText("42")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "まえへ" }));
    expect(screen.getByText(/7＋5＝12/)).toBeTruthy();
  });

  it("章のテストでは同じ位の表を使い、途中のヒントを出さない", () => {
    const lesson = GRADE_TWO_LESSONS["sansu-2-02"][0];
    render(<GradeTwoLesson practice={lesson.practice} summary={[lesson.test]} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("table", { name: "36 たす 27 のひっ算" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ひっ算の やり方を見る" })).toBeNull();
  });

  it("かけ算のまとまりを分け、1つずつ注目できる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-03"][0].practice;
    const { container } = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(container.querySelectorAll(".grade-two__group")).toHaveLength(4);
    expect(container.querySelectorAll(".grade-two__group-items span")).toHaveLength(12);
    expect(screen.queryByText("12こ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1つ分を 見る" }));
    expect(screen.getByText(/1つめの ふくろも 3こ/)).toBeTruthy();
    expect(container.querySelectorAll(".grade-two__group.is-focused")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "つぎの まとまり" }));
    expect(screen.getByText(/2つめの ふくろも 3こ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(container.querySelectorAll(".grade-two__group.is-focused")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "図で かんがえる" }));
    expect(container.querySelectorAll(".grade-two__group")).toHaveLength(4);
  });

  it("位・分数・人数の図を、それぞれ区切って表す", () => {
    const place = GRADE_TWO_LESSONS["sansu-2-01"][1].practice;
    const view = render(<GradeTwoLesson practice={place} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("table", { name: "数のまとまり" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "千のまとまり" })).toBeTruthy();
    expect(screen.queryByText("2345")).toBeNull();
    view.unmount();
    const fraction = GRADE_TWO_LESSONS["sansu-2-01"][5].practice;
    const fractionView = render(<GradeTwoLesson practice={fraction} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: /同じ大きさに2つ/ }).children).toHaveLength(2);
    expect(screen.queryByText("1/2")).toBeNull();
    fractionView.unmount();
    const data = GRADE_TWO_LESSONS["sansu-2-07"][1].practice;
    const dataView = render(<GradeTwoLesson practice={data} onExit={vi.fn()} onFinish={vi.fn()} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll("td")).toHaveLength(4);
    expect(rows[1].querySelectorAll("td")).toHaveLength(4);
    expect(screen.queryByText("2にん")).toBeNull();
    dataView.unmount();
    const calc = GRADE_TWO_LESSONS["sansu-2-02"][1].practice;
    render(<GradeTwoLesson practice={calc} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("columnheader", { name: "百のくらい" })).toBeTruthy();
    expect(screen.queryByText("150")).toBeNull();
  });

  it("花のなかま分けは問題文で答えを教えず、色別に数えられる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-01"][4].practice;
    expect(question.problem).not.toContain("4本");
    render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("table", { name: "1つが1本を表す表" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "赤" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "白" })).toBeTruthy();
    expect(screen.queryByText("4ほん")).toBeNull();
  });

  it("時計の小さい目もりと、5目もり進む動きを見せる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-06"][0].practice;
    render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    const clock = screen.getByRole("img", { name: /小さい目もり1つが1分/ });
    expect(clock.querySelectorAll("line")).toHaveLength(61);
    expect(screen.queryByText("60分")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "5目もり うごかす" }));
    expect(screen.getByRole("img", { name: /5目もり進んだ時計/ })).toBeTruthy();
    expect(screen.getByText(/5目もり すすむと 5分/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "はりを もどす" }));
    expect(screen.getByRole("img", { name: /小さい目もり1つが1分/ })).toBeTruthy();
  });

  it("図形の辺を一本ずつたどり、名前は先に出さない", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-04"][0].practice;
    const { container } = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    const shape = screen.getByRole("img", { name: /3本の まっすぐな辺/ });
    expect(shape.querySelectorAll("line")).toHaveLength(3);
    expect(shape.querySelectorAll("circle")).toHaveLength(3);
    expect(screen.queryByText("さんかくけい")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "辺を たどる" }));
    expect(container.querySelectorAll(".grade-two__polygon line.is-focused")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "つぎの 辺へ" }));
    expect(shape.querySelectorAll("line")[1].classList.contains("is-focused")).toBe(true);
  });

  it("かけ算の並びを比べ、元の図を回して戻せる", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-03"][2].practice;
    const { container } = render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    const left = screen.getByRole("img", { name: "3こずつ4れつの図" });
    const right = screen.getByRole("img", { name: "4こずつ3れつの図" });
    const dimensions = (svg: Element) => {
      const circles = [...svg.querySelectorAll("circle")];
      return [new Set(circles.map((circle) => circle.getAttribute("cx"))).size, new Set(circles.map((circle) => circle.getAttribute("cy"))).size];
    };
    expect(left.querySelectorAll("circle")).toHaveLength(12);
    expect(right.querySelectorAll("circle")).toHaveLength(12);
    expect(dimensions(left)).toEqual([3, 4]);
    expect(dimensions(right)).toEqual([4, 3]);
    expect(screen.queryByText("12")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "左の図を まわす" }));
    expect(screen.getByRole("img", { name: /図を回したところ/ }).querySelector("g")?.getAttribute("style")).toContain("90deg");
    fireEvent.click(screen.getByRole("button", { name: "図を もどす" }));
    expect(screen.getByRole("img", { name: "3こずつ4れつの図" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "図で かんがえる" }));
    expect(container.querySelectorAll(".array-compare")).toHaveLength(1);
  });
  it("章のテストでも違う並び方を表示する", () => {
    const lesson = GRADE_TWO_LESSONS["sansu-2-03"][2];
    render(<GradeTwoLesson practice={lesson.practice} summary={[lesson.test]} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: "2こずつ5れつの図" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "5こずつ2れつの図" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "左の図を まわす" })).toBeNull();
  });
  it("かけ算の工夫は問題文で指定せず、ヒントで示す", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-03"][5].practice;
    render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText("5 × 6 は いくつ？")).toBeTruthy();
    expect(screen.queryByText(/5×5に/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "図で かんがえる" }));
    expect(screen.getByText(/5×5に/)).toBeTruthy();
  });
  it("分数の問題の前に1/4で分母と分子の意味を説明する", () => {
    const fraction = GRADE_TWO_LESSONS["sansu-2-01"][5].practice;
    render(<GradeTwoLesson practice={fraction} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(fraction.problem)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("こたえの分子"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("こたえの分母"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "分数の見方の説明を見る" }));
    expect(screen.queryByText(fraction.problem)).toBeNull();
    expect(screen.getByRole("img", { name: "1L全体" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByRole("img", { name: "1Lを4等分した図" }).children).toHaveLength(4);
    expect(screen.getByText(/分母の4/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "分子がしかく、分母が4" }).children).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText(/分子の1/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "4分の1" }).textContent).toBe("14");
    expect(screen.queryByText("1/2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect(screen.getByText(fraction.problem)).toBeTruthy();
    expect((screen.getByLabelText("こたえの分子") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("こたえの分母") as HTMLInputElement).value).toBe("2");
  });
  it("かけ算の式を別のまとまりで説明し、実際の問題に移る", () => {
    const question = GRADE_TWO_LESSONS["sansu-2-03"][1].practice;
    render(<GradeTwoLesson practice={question} onExit={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(question.problem)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "かけ算の式の説明を見る" }));
    expect(screen.getByRole("heading", { name: "かけ算の式を知ろう" })).toBeTruthy();
    expect(screen.queryByText(question.problem)).toBeNull();
    expect(screen.getByRole("img", { name: /2こずつ.*3つのふくろ/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText("2 ＋ 2 ＋ 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "つぎへ" }));
    expect(screen.getByText("2 ＋ 2 ＋ 2 ＝ 2 × 3")).toBeTruthy();
    expect(screen.getByText(/1ふくろの数/)).toBeTruthy();
    expect(screen.queryByText("5×3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "問題にすすむ" }));
    expect(screen.getByText(question.problem)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "かけ算の式の説明を見る" }));
    expect(screen.getByRole("heading", { name: "かけ算の式を知ろう" })).toBeTruthy();
  });
});
