import type { StudioLesson } from "./lesson-ir.ts";

export const STUDIO_FIXTURES: {
  valid: StudioLesson;
  invalidShape: unknown;
  invalidMath: unknown;
} = {
  valid: {
    schemaVersion: 1,
    objective: "分母をそろえる意味をタイルで考えます",
    strategy: "visual",
    problems: [{ kind: "calculate", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, operator: "+", hints: ["同じ大きさのタイルでうめられるか考えましょう"] }],
  },
  invalidShape: {
    schemaVersion: 1,
    objective: "分母をそろえます",
    strategy: "visual",
    problems: [{ kind: "unknown", left: { num: 1, den: 2 }, right: { num: 1, den: 3 }, hints: ["タイルを見ましょう"] }],
  },
  invalidMath: {
    schemaVersion: 1,
    objective: "分数をたしかめます",
    strategy: "numeric",
    problems: [{ kind: "calculate", left: { num: 1, den: 3 }, right: { num: 1, den: 2 }, operator: "-", hints: ["タイルを見ましょう"] }],
  },
};
