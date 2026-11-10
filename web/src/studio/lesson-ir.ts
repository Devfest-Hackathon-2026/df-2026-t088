export interface StudioFraction {
  num: number;
  den: number;
}

export type StudioStrategy = "visual" | "numeric" | "misconception";
export type StudioProblemKind = "calculate" | "common" | "compare";

export interface StudioProblem {
  kind: StudioProblemKind;
  left: StudioFraction;
  right: StudioFraction;
  operator?: "+" | "-";
  hints: string[];
}

export interface StudioLesson {
  schemaVersion: 1;
  objective: string;
  strategy: StudioStrategy;
  problems: StudioProblem[];
}
