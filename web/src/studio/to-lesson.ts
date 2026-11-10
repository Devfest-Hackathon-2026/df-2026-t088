import { calculateProblem, commonProblem, compareProblem } from "../lesson/problems";
import type { LessonDefinition, LessonProblem } from "../lesson/problems";
import type { StudioLesson, StudioProblem } from "./lesson-ir";

function toProblem(problem: StudioProblem): LessonProblem {
  const { left, right } = problem;
  const generated = problem.kind === "calculate"
    ? calculateProblem(left, problem.operator!, right)
    : problem.kind === "common"
      ? commonProblem(left, right)
      : compareProblem(left, right);
  return { ...generated, hints: [...problem.hints] };
}

export function toLesson(ir: StudioLesson): LessonDefinition {
  return { id: "studio-preview", isTilesFirst: false, problems: ir.problems.map(toProblem) };
}
