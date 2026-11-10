// build-curriculum.mjs の型。テスト（src/data/courses.test.ts）が読む物だけ
export interface CodeRow {
  subject: string;
  no: string;
  text: string;
  code: string;
}
export const CSV_PATH: string;
export const MAX_ITEMS: number;
export function parseCsv(text: string): string[][];
export function readCodeTable(path?: string): CodeRow[];
export function tidy(text: string): string;
export function headOf(raw: string): { marker: string; rest: string };
export function bodyOf(raw: string): string;
export function markerOf(raw: string): string;
export function splitSizes(n: number, max?: number): number[];
