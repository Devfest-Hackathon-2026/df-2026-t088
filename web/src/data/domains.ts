import { COPY } from "../copy";
import type { Domain } from "./types";

// 章の道の分野名の順番（CP-257〜260）。章の分野は chapters.ts の domain で決める
export const DOMAINS: Domain[] = [
  { id: "number", name: COPY.CP_257 },
  { id: "shape", name: COPY.CP_258 },
  { id: "change", name: COPY.CP_259 },
  { id: "data", name: COPY.CP_260 },
];
