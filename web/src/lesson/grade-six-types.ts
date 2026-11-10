export type SixVisual =
  | { kind: "six"; type: "fraction"; a: [number, number]; b: [number, number]; operation: "multiply" | "divide"; unit?: string; baseUnit?: string; swapFactors?: boolean }
  | { kind: "six"; type: "expression"; price: number; count: number | "x"; extra: number; countUnit?: string }
  | { kind: "six"; type: "transform"; mode: "scale" | "line" | "point" | "map"; width: number; height: number; factor: number; markedPoint?: "A" | "B" }
  | { kind: "six"; type: "estimate"; shape: "rectangle" | "triangle"; width: number; height: number }
  | { kind: "six"; type: "stats"; values: number[]; other?: number[]; measure: "mean" | "median" | "mode" | "frequency" | "histogram" | "compare"; unit: string }
  | { kind: "six"; type: "survey"; choices: [string, string] }
  | { kind: "six"; type: "possibilities"; items: string[]; ordered: boolean };
