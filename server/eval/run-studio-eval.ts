import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiClient, CompileLessonInput } from "../src/ai/client.ts";
import { GeminiAiClient } from "../src/ai/gemini-client.ts";
import { MockAiClient } from "../src/ai/mock-client.ts";
import { readAiSettings } from "../src/ai/settings.ts";
import type { StudioStrategy } from "../src/studio/lesson-ir.ts";
import { validateLessonIr, type LessonIrValidation } from "../src/studio/validate-ir.ts";
import { assertEvalAiAllowed, assertEvalSettingsMatchIntent, describeAiSettings } from "../src/eval/parts-eval.ts";

export const STUDIO_EVAL_PROMPTS = [
  "分母がちがう分数のたし算を、タイルで考える教材を作ってください",
  "分母がちがう分数のひき算を、タイルで考える教材を作ってください",
  "分数のたし算で分母をそろえる意味が分かる教材を作ってください",
  "分数のひき算で分母をそろえる意味が分かる教材を作ってください",
  "同じ大きさの分数を見つける教材を作ってください",
  "分数の大きさを比べる教材を作ってください",
  "分数のたし算で分子と分母を両方たしてしまう間違いを考える教材を作ってください",
  "分数のひき算で分子と分母を両方ひいてしまう間違いを考える教材を作ってください",
  "分数のたし算を図と式で確かめる教材を作ってください",
  "分数のひき算を図と式で確かめる教材を作ってください",
] as const;

const STRATEGIES: StudioStrategy[] = ["visual", "numeric", "misconception"];
type EvalSource = "gemini" | "mock";

export type StudioEvalResult = {
  promptIndex: number;
  prompt: string;
  strategy: StudioStrategy;
  passed: boolean;
  attempts: number;
  retryCount: number;
  elapsedMs: number;
  validation: LessonIrValidation;
  error?: boolean;
};
export type StudioEvalReport = {
  evaluatedAt?: string;
  source: EvalSource;
  ai?: ReturnType<typeof describeAiSettings>;
  summary: {
    total: number;
    passed: number;
    passRate: number;
    retryCount: number;
    retryRate: number;
    durationP50Ms: number;
    durationP95Ms: number;
  };
  results: StudioEvalResult[];
};

export async function evaluateStudio(
  client: Pick<AiClient, "compileLesson">,
  source: EvalSource,
  prompts: readonly string[] = STUDIO_EVAL_PROMPTS,
): Promise<StudioEvalReport> {
  if (!client.compileLesson) throw new Error("AI クライアントに教材生成機能がありません。");
  const results: StudioEvalResult[] = [];

  for (const [promptIndex, prompt] of prompts.entries()) {
    for (const strategy of STRATEGIES) {
      results.push(await evaluateCase(client.compileLesson.bind(client), promptIndex + 1, prompt, strategy));
    }
  }

  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const retryCount = results.reduce((sum, result) => sum + result.retryCount, 0);
  const durations = results.map((result) => result.elapsedMs).sort((left, right) => left - right);
  return {
    source,
    summary: {
      total,
      passed,
      passRate: total ? passed / total : 0,
      retryCount,
      retryRate: total ? retryCount / total : 0,
      durationP50Ms: percentile(durations, 0.5),
      durationP95Ms: percentile(durations, 0.95),
    },
    results,
  };
}

async function evaluateCase(
  compileLesson: NonNullable<AiClient["compileLesson"]>,
  promptIndex: number,
  prompt: string,
  strategy: StudioStrategy,
): Promise<StudioEvalResult> {
  const startedAt = performance.now();
  const validations: LessonIrValidation[] = [];
  let attempts = 0;
  let error = false;

  while (attempts < 2) {
    const input: CompileLessonInput = {
      prompt,
      strategy,
      ...(attempts === 1 && !validations.at(-1)?.ok
        ? { validationIssues: (validations.at(-1) as Extract<LessonIrValidation, { ok: false }>).issues }
        : {}),
    };
    attempts += 1;
    try {
      const validation = validateLessonIr(await compileLesson(input, AbortSignal.timeout(30_000)));
      validations.push(validation);
      if (validation.ok) break;
    } catch {
      error = true;
      break;
    }
  }

  const validation = validations.at(-1) ?? { ok: false, issues: ["教材を生成できませんでした。"] };
  return {
    promptIndex,
    prompt,
    strategy,
    passed: validation.ok,
    attempts,
    retryCount: Math.max(0, attempts - 1),
    elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
    validation,
    ...(error ? { error: true } : {}),
  };
}

function percentile(sorted: number[], fraction: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

async function main(): Promise<void> {
  const environment = process.env;
  console.info = (...values: unknown[]) => console.error(...values);
  const args = process.argv.slice(2);
  const forceMock = args.includes("--mock");
  assertEvalAiAllowed(forceMock ? {} : environment);
  const settings = readAiSettings(forceMock ? {} : environment);
  assertEvalSettingsMatchIntent(environment, settings);
  const client = settings.mode === "mock" ? new MockAiClient() : new GeminiAiClient(settings);
  const source: EvalSource = settings.mode === "mock" ? "mock" : "gemini";
  const outputArgument = args.find((value) => value !== "--mock");
  const defaultName = `studio-${source}.json`;
  const outputPath = resolve(outputArgument ?? `eval/results/${defaultName}`);
  const report = await evaluateStudio(client, source);
  report.evaluatedAt = new Date().toISOString();
  report.ai = describeAiSettings(settings);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report.summary)}\nJSON: ${outputPath}\nAI: ${JSON.stringify(report.ai)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
