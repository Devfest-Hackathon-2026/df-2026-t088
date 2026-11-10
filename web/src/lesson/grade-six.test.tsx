import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chaptersOf } from "../data";
import { UPPER_MATH, findUpperMath, upperMathSummary } from "./upper-math";
import { conceptFor } from "./upper-concepts";
import { UpperMathLesson, isUpperAnswerCorrect } from "../pages/lesson/UpperMathLesson";
import { lessonCatalog } from "../dev/lesson-catalog";

afterEach(cleanup);
const questions = chaptersOf(6, "sansu").flatMap((chapter) => UPPER_MATH[chapter.id].main.flatMap((item, index) =>
  [item.practice, ...(item.practice.followUps ?? []), item.test, ...(item.test.followUps ?? [])].map((question, sub) => ({ question, name: `${chapter.id}/${index}/${sub}` }))));

function answerQuestion(answer: string) {
  const numerator = screen.queryByLabelText("答えの分子");
  if (numerator) {
    const [num, den] = answer.split("/");
    fireEvent.change(numerator, { target: { value: num } });
    fireEvent.change(screen.getByLabelText("答えの分母"), { target: { value: den ?? "1" } });
  } else fireEvent.change(screen.getByLabelText(/^答え/), { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: "答える" }));
}

describe("6年生の全章", () => {
  it.each(questions.filter(({question}) => question.visual.kind === "six"))("$name の図の数値と採点用の答えが数学的に一致する", ({question}) => {
    const v = question.visual;
    if (v.kind !== "six") throw new Error("6年の図ではありません");
    const answer = Number(question.answer);
    if (v.type === "fraction") {
      const [n,d] = question.answer.split("/").map(Number);
      if (question.title.includes("きまり")) expect(n*v.b[1]).toBe(d*v.b[0]);
      else if (v.operation === "multiply") expect(n*v.a[1]*v.b[1]).toBe(d*v.a[0]*v.b[0]);
      else expect(n*v.a[1]*v.b[0]).toBe(d*v.a[0]*v.b[1]);
    }
    if (v.type === "expression" && typeof v.count === "number") expect(v.price*v.count+v.extra).toBe(answer);
    if (v.type === "estimate") expect(v.width*v.height/(v.shape==="triangle"?2:1)).toBe(answer);
    if (v.type === "possibilities") expect(v.items.length*(v.items.length-1)/(v.ordered?1:2)).toBe(answer);
    if (v.type === "transform") {
      if(v.mode === "map") expect(v.width*v.factor/100).toBe(answer);
      if(v.mode === "scale") expect((question.title === "縮図" ? v.width : v.height)*v.factor).toBe(answer);
      if(v.mode === "line") expect(v.width).toBe(answer);
      if(v.mode === "point") expect(question.answer).toBe(v.markedPoint === "B"?"D":"C");
    }
    if (v.type === "stats") {
      const sorted = [...v.values].sort((a,b)=>a-b);
      if(v.measure === "median") expect((sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2).toBe(answer);
      if(v.measure === "mode") expect(v.values.filter(x=>x===answer).length).toBe(Math.max(...v.values.map(x=>v.values.filter(y=>x===y).length)));
      if(v.measure === "mean") expect(v.values.reduce((a,b)=>a+b,0)/v.values.length).toBe(answer);
      if(v.measure === "frequency" || v.measure === "histogram") expect(v.values.filter(x=>x>=20 && x<30).length).toBe(answer);
      if(v.measure === "compare") expect(Math.max(...v.values)-Math.min(...v.values)<Math.max(...v.other!)-Math.min(...v.other!)?"A":"B").toBe(question.answer);
    }
  });
  it("全10章・37マスに教材があり、全70問が練習と章末に分かれる", () => {
    expect(chaptersOf(6, "sansu")).toHaveLength(10);
    const entries = lessonCatalog(6).flatMap((group) => group.entries);
    expect(entries).toHaveLength(37);
    expect(entries.every((entry) => entry.count > 0)).toBe(true);
    expect(questions).toHaveLength(70);
    for (const chapter of chaptersOf(6, "sansu")) {
      chapter.items.forEach((_, index) => expect(findUpperMath(chapter.id, {kind:"main",index})).toBeDefined());
      expect(upperMathSummary(chapter.id).length).toBeGreaterThanOrEqual(chapter.items.length);
    }
  });
  it.each(questions)("$name は答えを先に示さず、正しい入力を受け付ける", ({question}) => {
    render(<UpperMathLesson practice={{...question,followUps:undefined}} onExit={() => {}} onFinish={() => {}} />);
    expect(screen.queryByText(question.explanation, {exact:true})).toBeNull();
    const visual = question.visual;
    if (visual.kind === "prism" && visual.baseDimensions) {
      expect(screen.queryByRole("button", {name:"答える"})).toBeNull();
      fireEvent.change(screen.getByLabelText("底面積（cm²）"), {target:{value:String(visual.baseArea)}});
      fireEvent.click(screen.getByRole("button", {name:"底面積を答える"}));
    }
    answerQuestion(question.answer);
    expect(screen.getByText(question.explanation, {exact:true})).toBeTruthy();
    expect(screen.getByRole("button", {name:"ばんめんにもどる"})).toBeTruthy();
  });
  it("分数は帯分数・同値の分数を受け付け、分母0や不完全な入力を拒む", () => {
    const question = UPPER_MATH["sansu-6-01"].main[1].practice;
    for (const answer of ["3/2", "６/４", "1と1/2"]) expect(isUpperAnswerCorrect(answer, question)).toBe(true);
    for (const answer of ["3/0", "3/", "/2", "0", "2/3"]) expect(isUpperAnswerCorrect(answer, question)).toBe(false);
  });
  it("中央値の練習を終えても最頻値・平均の練習が終わるまでは完了しない", () => {
    const practice = UPPER_MATH["sansu-6-09"].main[0].practice;
    const finish = vi.fn();
    render(<UpperMathLesson practice={practice} onExit={() => {}} onFinish={finish} />);
    for (const question of [practice,...practice.followUps!]) {
      expect(screen.getByText(question.problem)).toBeTruthy();
      expect(finish).not.toHaveBeenCalled();
      answerQuestion(question.answer);
      fireEvent.click(screen.getByRole("button",{name:question===practice.followUps!.at(-1)?"ばんめんにもどる":"つぎの問題へ"}));
    }
    expect(finish).toHaveBeenCalledOnce();
  });
  it.each(chaptersOf(6, "sansu"))("$id の章末テストを最初から最後まで進められる", ({id}) => {
    const summary = upperMathSummary(id);
    const finish = vi.fn();
    render(<UpperMathLesson practice={summary[0]} summary={summary} onExit={() => {}} onFinish={finish} />);
    summary.forEach((question, index) => {
      expect(screen.getByText(question.problem)).toBeTruthy();
      expect(finish).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", {name:/図の動きを見る|図を使って考える|説明を見る/})).toBeNull();
      answerQuestion(question.answer);
      fireEvent.click(screen.getByRole("button", {
        name: index === summary.length - 1 ? "ばんめんにもどる" : "つぎの問題へ",
      }));
    });
    expect(finish).toHaveBeenCalledOnce();
  });
  it.each(questions)("$name の図と基礎説明は全段階を表示できる", ({question}) => {
    render(<UpperMathLesson practice={{...question,followUps:undefined}} onExit={() => {}} onFinish={() => {}} />);
    fireEvent.click(screen.getByRole("button",{name:"図を使って考える"}));
    fireEvent.click(screen.getByRole("button",{name:"次へ"}));
    expect(screen.getByText(question.hints[1],{exact:true})).toBeTruthy();
    const concept = conceptFor(question);
    if (!concept) {
      expect(question.visual.kind).not.toBe("six");
      return;
    }
    fireEvent.click(screen.getByRole("button",{name:`${concept.name}の説明を見る`}));
    for (let i=0;i<concept.scenes.length;i++) {
      expect(screen.getByText(concept.scenes[i].text,{exact:true})).toBeTruthy();
      if(i+1<concept.scenes.length) fireEvent.click(screen.getByRole("button",{name:"つぎへ"}));
    }
    fireEvent.click(screen.getByRole("button",{name:"問題にすすむ"}));
    expect(screen.getByText(question.problem)).toBeTruthy();
  });
});
