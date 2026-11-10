import { GoogleGenAI, MediaResolution, ThinkingLevel } from "@google/genai";
import type { ReflectionInput } from "../api-types.ts";
import type { AiClient, CompileLessonInput, DraftLessonPatchInput, PrintReadInput } from "./client.ts";
import { PRINT_DEMAND_UNITS, printDemandUnitId } from "../print/demand.ts";
import type { AiSettings } from "./settings.ts";
import type { NamedPattern } from "../loop/hint-table.ts";

const PATTERN_DESCRIPTION: Record<NamedPattern, string> = {
  "sum-both": "分子どうし、分母どうしを計算した形",
  "sum-num-only": "分子だけを計算し、分母は変えなかった形",
  "same-den-sum": "通分した後に分母も足した形（正しい答えの半分）",
  "lever-same-weight": "右にも左と同じ重さをつるした形（答えは左のおもりの重さ）",
  "lever-inverse": "てこの比を逆にした形（左のおもりの重さ × 右のめもり ÷ 左のめもり）",
};

const PARTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    problem: { type: "string" },
    tool: { type: "string", enum: ["fraction_tiles"] },
    pieces: { type: "array", items: { type: "object", additionalProperties: false, properties: {
      num: { type: "integer" }, den: { type: "integer" }, count: { type: "integer" },
    }, required: ["num", "den", "count"] } },
    answer: { type: "object", additionalProperties: false, properties: { num: { type: "integer" }, den: { type: "integer" } }, required: ["num", "den"] },
    hints: { type: "array", items: { type: "string" } },
  },
  required: ["problem", "tool", "pieces", "answer", "hints"],
} as const;

const STUDIO_FRACTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { num: { type: "integer", minimum: 1, maximum: 11 }, den: { type: "integer", minimum: 2, maximum: 12 } },
  required: ["num", "den"],
} as const;

const LESSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    objective: { type: "string", maxLength: 60 },
    strategy: { type: "string", enum: ["visual", "numeric", "misconception"] },
    problems: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["calculate", "common", "compare"] },
        left: STUDIO_FRACTION_SCHEMA,
        right: STUDIO_FRACTION_SCHEMA,
        operator: { type: "string", enum: ["+", "-"] },
        hints: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", maxLength: 80 } },
      }, required: ["kind", "left", "right", "hints"],
    }, minItems: 1, maxItems: 3 },
  }, required: ["schemaVersion", "objective", "strategy", "problems"],
} as const;

const LESSON_PATCH_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    baseVersion: { type: "integer" },
    operations: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: {
        type: { type: "string", enum: ["replaceHint", "addHint", "replaceNumbers", "setStrategy"] },
        problemNumber: { type: "integer" }, hintNumber: { type: "integer" }, text: { type: "string" },
        left: { type: "object", additionalProperties: false, properties: { num: { type: "integer" }, den: { type: "integer" } }, required: ["num", "den"] },
        right: { type: "object", additionalProperties: false, properties: { num: { type: "integer" }, den: { type: "integer" } }, required: ["num", "den"] },
        strategy: { type: "string", enum: ["visual", "numeric", "misconception"] },
      }, required: ["type"],
    } },
  }, required: ["baseVersion", "operations"],
} as const;

const PRINT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    problems: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: {
        questionText: { type: "string", maxLength: 200 },
        // none を選べるようにして、型の無い問題が月の型（数が無いので検査を素通りする）に流れ込むのを防ぐ
        templateId: { type: "string", enum: ["rika-lever", "rika-moon", "sansu-fraction-addsub", "none"] },
        unit: { type: "string", enum: [...PRINT_DEMAND_UNITS.map(({ id }) => id), "other"] },
        // params をそのまま object で書かせると中身が空になりやすいので、てこの数は平らな項目で受けて、下で params に組み立てる
        leverLeftPos: { type: "integer", minimum: 0, maximum: 6 },
        leverLeftG: { type: "integer", minimum: 0, maximum: 100 },
        leverRightPos: { type: "integer", minimum: 0, maximum: 6 },
        // 分数の式も平らな項目で受ける。範囲の検査は server が行うので、ここでは範囲を縛らない
        fractionLeftNum: { type: "integer" },
        fractionLeftDen: { type: "integer" },
        fractionOp: { type: "string", enum: ["+", "-", "unused"] },
        fractionRightNum: { type: "integer" },
        fractionRightDen: { type: "integer" },
        // 数の項目を任意にすると、型が増えたときに Gemini が書き忘れる（分数を足した後、てこの重さが抜けて 100% → 73% に落ちた。2026-11-10 に測定）。
        // 全部を必須にして、関係ない項目には 0（fractionOp は unused）を書かせる。型に合う項目だけを下で params に組み立てる
      }, required: ["questionText", "templateId", "leverLeftPos", "leverLeftG", "leverRightPos", "fractionLeftNum", "fractionLeftDen", "fractionOp", "fractionRightNum", "fractionRightDen"],
    } },
    unsupportedCount: { type: "integer", minimum: 0 },
    unreadable: { type: "boolean" },
  }, required: ["problems", "unsupportedCount"],
} as const;

const PRINT_INSTRUCTION = `プリント写真から問題を上から順に読み取ります。出力項目を最小限にし、JSON の形を守ってください。
各問題では、最初に questionText に印刷された問題文をそのまま写し、その後 templateId を選び、必要な数を書きます。人の名前や手書きの答えは読まず、文字起こししません。
templateId の選び方：
- rika-lever：てこのつり合いの問題（支点・目もり・おもりが出てくる）。leverLeftPos は左のおもりをかけた目もり（1〜6）、leverLeftG は左のおもりの重さ（10〜100 の10刻み）、leverRightPos は右の目もり（1〜6）。3 つとも必ず書く（leverLeftG を省かない。3 つがそろわない rika-lever は使えない）。重さは「重さは30gです」のように別の文に書かれていることや、図のおもりに書かれていることがあるので、文と図の両方から探す。答え（右の重さ）は計算して書かない。leverLeftG * leverLeftPos / leverRightPos が10から100の10の倍数にならないときは none にする。
- rika-moon：月の形や見え方が変わる理由をたずねる問題。満ち欠けの図だけで問題文が短くても、月の図を見て選ぶ。数の項目はすべて 0 にする。
- sansu-fraction-addsub：分数 2 つのたし算かひき算の式の問題だけ。fractionLeftNum・fractionLeftDen は左の分数の分子・分母、fractionOp は + か -、fractionRightNum・fractionRightDen は右の分数の分子・分母。5 つとも必ず書く。答えは計算して書かない。帯分数、分数 3 つ以上、かけ算・わり算、分母が12より大きい式は none にして unit を sansu-5-fraction にする。
- none：上のどれでもない問題（速さ・面積など、てこ・月・分数のたし算ひき算以外はすべて none）。
数の項目（lever の 3 つと fraction の 5 つ）は、どの問題でも全部書きます。選んだ templateId に関係ない数は 0、fractionOp は unused と書きます。rika-moon は月の形や見え方をたずねる問題で、none はてこ・月・分数のたし算ひき算以外の問題です。
none にした問題には unit を必ず付けます。unit は none の問題にだけ書き、ほかの templateId の問題には書きません。unit は6年の算数・理科の一覧から1つ選び、一覧にない単元や判断できない場合は other にします。問題文以外の自由な説明は出力しません。
文字がかすれる、切れているなど読めない箇所を推測しません。写真全体から問題の文を読めなければ problems を空にして unreadable=true にします。unsupportedCount には、none にした問題は数えず、0 を書きます（none の数はサーバが数えます）。`;

const REFLECTION_INSTRUCTION = "小学5年生向けの分数の算数だけを話します。解けた後の説明を受けて、採点や正誤判定をせず、答えを先に言わず、問いかけを1つだけ、80文字以内で返します。算数以外の話題は算数に戻します。名前や学校名を書かないよう案内してください。";
const PARTS_INSTRUCTION = "小学5年生向けに、与えられた分数の式を次の形のJSONだけで返します。項目名は problem、tool、pieces、answer、hints から変えず、項目を追加しません。tool は fraction_tiles です。pieces は式の2つの分数と、両方の分母の最小公倍数を分母とする単位分数だけです。単位分数の枚数は、たし算では式の2つの分数に必要な枚数の合計、ひき算では引かれる数に必要な枚数です。answer は約分した形にします。hints は1〜3個を順番に出す短いヒントにし、答えの分数を書きません。言葉は小学5年生に分かるものにします。";
const SIMILAR_INSTRUCTION = `${PARTS_INSTRUCTION} 類題は元の式と同じ演算で、元とは異なる分母の組にし、答えが負にならない式にします。`;
const LOOP_HINT_INSTRUCTION = "小学5年生向けの直し方の文を1つだけ、日本語で下書きします。型の分析はせず、与えられた規則表の説明をやさしく言い換えます。演算に合う言い方にし、数字、リンク、答え、前置きや引用符は加えません。80文字以内の1段落だけを返します。";
// 決まりは server/src/studio/validate-ir.ts と server/src/loop/check-hint.ts の検査と同じ。検査を変えたら、ここも直す
const STUDIO_INSTRUCTION = [
  "これは子ども向けの応答ではなく、大人（先生）向けの教材づくりの道具です。先生の依頼に合わせ、小学5年生の分数タイルの教材（Lesson IR）を作ります。",
  "出力は Lesson IR の JSON だけにし、説明や Markdown は加えません。strategy は入力で指定されたものをそのまま使います。",
  "作った教材はプログラムが検査し、次の決まりを1つでも破ると使われません。",
  "- objective（指導のねらい）は60字以内の1文。",
  "- problems は1〜3問。kind は calculate（たし算・ひき算）、common（通分）、compare（大きさ比べ）のどれか。",
  "- left と right は真分数。分子は1以上で分母より小さく、分母は2〜12。",
  "- operator は kind が calculate のときだけ付け、+ か - にする。common と compare には operator を付けない。",
  "- ひき算は、答えが0より大きくなるように left を right より大きくする。",
  "- hints は1〜3個。どれも80字以内の1文で、改行しない。",
  "- hints に数字を書かない。算用数字（1、2）も漢数字（一、二、十）も分数の表記（1/2）も使わない。「左の分数」「同じ大きさのタイル」のように言葉で書く。",
  "- hints に答えを書かない。リンクも書かない。",
  "- hints の言葉は演算に合わせる。たし算の問題に「ひく」、ひき算の問題に「たす」を使わない。common と compare では「たす」「ひく」を使わない。",
  "検査に落ちた理由（validationIssues）が与えられたときは、その理由をすべて直した教材を作り直します。",
].join("\n");
const PATCH_INSTRUCTION = "これは子ども向けではなく、大人（先生）向けの教材づくりの道具です。今の Lesson IR を先生の依頼に合わせて直す Teaching Patch を作ります。出力は Teaching Patch の JSON だけにし、説明や Markdown は加えません。操作は replaceHint、addHint、replaceNumbers、setStrategy のみを使い、問題番号（problemNumber）とヒント番号（hintNumber）は 1 から数え、baseVersion は入力値のまま返します。適用はしません。";

export class GeminiAiClient implements AiClient {
  // 学びの輪の直し方の下書きは止めている（2026-11-10）。公開版で、間違え方そのものを勧める文が返った
  // （「分子は分子同士、分母は分母同士をそのまま足そう」）。原因は、下書きの元として「直し方」ではなく「間違え方の説明」を渡していること。
  // 検査（数字が無い・長さ・演算の言葉）はこの誤りを落とせない。直して測り直すまで、人が書いた表の案だけを出す
  readonly loopHintDraftEnabled = false;
  readonly source = "gemini" as const;

  private readonly genai: GoogleGenAI;

  constructor(settings: Exclude<AiSettings, { mode: "mock" }>) {
    this.genai = settings.mode === "developer"
      ? new GoogleGenAI({ apiKey: settings.apiKey })
      : new GoogleGenAI({ vertexai: true, project: settings.project, location: settings.location });
    this.model = settings.model;
    this.modelName = settings.model;
  }

  private readonly model: string;
  readonly modelName: string;

  async createParts(expression: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: `式: ${expression}`,
      config: { systemInstruction: PARTS_INSTRUCTION, responseMimeType: "application/json", responseJsonSchema: PARTS_SCHEMA, abortSignal: signal },
    });
    return parseJsonResponse(response.text);
  }

  async createSimilarProblem(problem: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: `元の式: ${problem}`,
      config: { systemInstruction: SIMILAR_INSTRUCTION, responseMimeType: "application/json", responseJsonSchema: PARTS_SCHEMA, abortSignal: signal },
    });
    return parseJsonResponse(response.text);
  }

  async createReflection(input: ReflectionInput, signal: AbortSignal): Promise<string> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: JSON.stringify({ problem: input.problem, message: input.message, history: input.history }),
      config: { systemInstruction: REFLECTION_INSTRUCTION, abortSignal: signal },
    });
    return response.text ?? "";
  }

  async readPrint(input: PrintReadInput, signal: AbortSignal): Promise<unknown> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: [
        { inlineData: { mimeType: input.image.mimeType, data: input.image.data } },
        { text: input.validationIssues?.length ? `前回の検査理由: ${input.validationIssues.join("、")}` : "この写真を読み取ってください。" },
      ],
      config: { systemInstruction: PRINT_INSTRUCTION, responseMimeType: "application/json", responseJsonSchema: PRINT_SCHEMA, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM, abortSignal: signal },
    });
    return toPrintOutput(parseJsonResponse(response.text));
  }

  async compileLesson(input: CompileLessonInput, signal: AbortSignal): Promise<unknown> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: JSON.stringify(input),
      config: { systemInstruction: STUDIO_INSTRUCTION, responseMimeType: "application/json", responseJsonSchema: LESSON_SCHEMA, abortSignal: signal },
    });
    return parseJsonResponse(response.text);
  }

  async draftLessonPatch(input: DraftLessonPatchInput, signal: AbortSignal): Promise<unknown> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: JSON.stringify(input),
      config: { systemInstruction: PATCH_INSTRUCTION, responseMimeType: "application/json", responseJsonSchema: LESSON_PATCH_SCHEMA, abortSignal: signal },
    });
    return parseJsonResponse(response.text);
  }

  async draftLoopHint(input: { pattern: NamedPattern; operator: "+" | "-" }, signal: AbortSignal): Promise<string> {
    const response = await this.genai.models.generateContent({
      model: this.model,
      contents: JSON.stringify({ pattern: input.pattern, description: PATTERN_DESCRIPTION[input.pattern], operator: input.operator }),
      config: { systemInstruction: LOOP_HINT_INSTRUCTION, abortSignal: signal },
    });
    return response.text ?? "";
  }
}

function parseJsonResponse(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Gemini の平らな項目を、画面と同じ params の形に組み立てる。形の検査は print/validate.ts が行う */
export function toPrintOutput(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { problems?: unknown }).problems)) return value;
  const output = value as { problems: unknown[] } & Record<string, unknown>;
  return { ...output, problems: output.problems.map((entry) => {
    if (typeof entry !== "object" || entry === null) return entry;
    const { leverLeftPos, leverLeftG, leverRightPos, fractionLeftNum, fractionLeftDen, fractionOp, fractionRightNum, fractionRightDen, ...rest } = entry as Record<string, unknown>;
    if (rest.templateId === "none") return { templateId: "none", questionText: rest.questionText, unit: printDemandUnitId(rest.unit) };
    if (rest.templateId === "rika-lever") {
      const complete = [leverLeftPos, leverLeftG, leverRightPos].every((number) => typeof number === "number" && Number.isInteger(number) && number >= 1);
      return { ...rest, ...(complete ? { params: { left: { pos: leverLeftPos, g: leverLeftG }, right: { pos: leverRightPos } } } : {}) };
    }
    if (rest.templateId === "sansu-fraction-addsub") {
      const params = { left: { num: fractionLeftNum, den: fractionLeftDen }, op: fractionOp, right: { num: fractionRightNum, den: fractionRightDen } };
      // 問題文は Gemini の文に頼らず、数から組み立てる。数が欠けていれば元の文のまま渡し、検査で落とす
      const complete = [fractionLeftNum, fractionLeftDen, fractionRightNum, fractionRightDen].every(Number.isInteger) && (fractionOp === "+" || fractionOp === "-");
      return { ...rest, ...(complete ? { questionText: `${fractionLeftNum}/${fractionLeftDen} ${fractionOp} ${fractionRightNum}/${fractionRightDen}`, params } : {}) };
    }
    if (rest.templateId === "rika-moon") return { ...rest, params: {} };
    return { ...rest, params: {} };
  }), unsupportedCount: Number.isInteger(output.unsupportedCount) ? output.unsupportedCount as number : 0 };
}
