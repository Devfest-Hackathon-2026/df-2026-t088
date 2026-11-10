import { useMemo, useState } from "react";
import { STUDIO_MOCK_LESSON } from "./api";
import type { StudioLesson } from "./lesson-ir";

type EvidenceSource = "measured" | "dummy" | "simulation" | "mock" | "gemini";
type ApprovalRecord = { decision: "approved" | "rejected" | "revoked"; at: string; reason: string };
export type EvidenceVersion = {
  id: string;
  lessonId: string;
  number: number;
  baseVersion: number | null;
  status: string;
  transitions: string[];
  lesson: StudioLesson;
  validation: { ok: true } | { ok: false; issues: string[] };
  createdAt: string;
  isFixture: boolean;
  generation?: { model: string; elapsedMs: number; source: EvidenceSource };
  comparedToVersion?: number | null;
  approvalHistory?: ApprovalRecord[];
};

const MOCK_VERSIONS: EvidenceVersion[] = [
  {
    id: "studio-mock@v1", lessonId: "studio-mock", number: 1, baseVersion: null,
    status: "published", transitions: ["draft", "validating", "review_required", "approved", "published"],
    lesson: STUDIO_MOCK_LESSON, validation: { ok: true }, createdAt: "2026-11-09T00:00:00.000Z", isFixture: true,
    generation: { model: "mock", elapsedMs: 120, source: "mock" }, comparedToVersion: null,
    approvalHistory: [{ decision: "approved", at: "2026-11-09T00:01:00.000Z", reason: "見本として確認しました" }],
  },
  {
    id: "studio-mock@v2", lessonId: "studio-mock", number: 2, baseVersion: 1,
    status: "rejected", transitions: ["draft", "validating", "rejected"],
    lesson: {
      ...STUDIO_MOCK_LESSON, strategy: "numeric",
      problems: STUDIO_MOCK_LESSON.problems.map((problem) => ({ ...problem, hints: ["タイルを同じ大きさで並べましょう"] })),
    },
    validation: { ok: true }, createdAt: "2026-11-09T00:02:00.000Z", isFixture: true,
    generation: { model: "mock", elapsedMs: 180, source: "dummy" }, comparedToVersion: 1,
    approvalHistory: [{ decision: "rejected", at: "2026-11-09T00:03:00.000Z", reason: "数の説明を先に確認したいため" }],
  },
];

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  measured: "実測", dummy: "ダミー", simulation: "シミュレーション", mock: "mock", gemini: "Gemini",
};
const STRATEGY_LABEL: Record<StudioLesson["strategy"], string> = {
  visual: "図で考える", numeric: "数で考える", misconception: "つまずきから考える",
};
const DECISION_LABEL: Record<ApprovalRecord["decision"], string> = {
  approved: "承認", rejected: "却下", revoked: "取り消し",
};

function diffValues(before: unknown, after: unknown, path = "", changes: { path: string; before: string; after: string }[] = []) {
  if (Object.is(before, after)) return changes;
  if (Array.isArray(before) && Array.isArray(after)) {
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      diffValues(before[index], after[index], `${path}[${index + 1}]`, changes);
    }
  } else if (isRecord(before) && isRecord(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      diffValues(before[key], after[key], path ? `${path}.${key}` : key, changes);
    }
  } else {
    changes.push({ path, before: formatValue(before), after: formatValue(after) });
  }
  return changes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === undefined) return "なし";
  return typeof value === "string" ? value : JSON.stringify(value);
}

const PLAIN_SOURCE_LABEL: Record<EvidenceSource, string> = {
  measured: "実測", dummy: "ダミー", simulation: "シミュレーション", mock: "見本", gemini: "AI",
};

function sourceLabel(version: EvidenceVersion, plain: boolean): string {
  const source = version.generation?.source ?? (version.isFixture ? "mock" : undefined);
  return source ? (plain ? PLAIN_SOURCE_LABEL : SOURCE_LABEL)[source] : "未記録";
}

function markedSource(version: EvidenceVersion): boolean {
  const source = version.generation?.source ?? (version.isFixture ? "mock" : undefined);
  return source === "mock" || source === "dummy";
}

// plain は先生の画面（SCR-T15）。版・戦略などの研究用の言葉を、先生の言葉に替える
export function EvidencePanel({ versions = MOCK_VERSIONS, plain = false }: { versions?: EvidenceVersion[]; plain?: boolean }) {
  const word = (research: string, teacher: string) => plain ? teacher : research;
  const turn = (number: number | undefined) => plain ? `${number} 回目` : `版 ${number}`;
  const sortedVersions = useMemo(() => [...versions].sort((left, right) => left.number - right.number), [versions]);
  const [fromNumber, setFromNumber] = useState(() => sortedVersions[0]?.number ?? 0);
  const [toNumber, setToNumber] = useState(() => sortedVersions[1]?.number ?? sortedVersions[0]?.number ?? 0);
  const from = sortedVersions.find((version) => version.number === fromNumber);
  const to = sortedVersions.find((version) => version.number === toNumber);
  const changes = from && to ? diffValues(from.lesson, to.lesson) : [];
  const generations = sortedVersions.flatMap((version) => version.generation ? [version.generation] : []);
  const decided = sortedVersions.filter((version) => ["approved", "published", "rejected", "revoked"].includes(version.status));
  const approved = decided.filter((version) => ["approved", "published", "revoked"].includes(version.status)).length;
  const passed = sortedVersions.filter((version) => version.validation.ok).length;
  const p50 = percentile(generations.map((item) => item.elapsedMs), 0.5);
  const p95 = percentile(generations.map((item) => item.elapsedMs), 0.95);

  return (
    <section aria-labelledby="studio-evidence-title">
      <h2 id="studio-evidence-title">{word("版の根拠と出どころ", "つくった記録")}</h2>
      <p role="note">{word("見本データを含みます。学習の効果は未計測です。", "見本のデータを含みます。学習の効果は、まだ測っていません。")}</p>
      <dl>
        <div><dt>{word("生成数", "つくった数")}</dt><dd>{sortedVersions.length} 件</dd></div>
        <div><dt>{word("検査の通過率", "検査に通った割合")}</dt><dd>{rate(passed, sortedVersions.length)}</dd></div>
        <div><dt>{word("承認率", "承認した割合")}</dt><dd>{rate(approved, decided.length)}</dd></div>
        <div><dt>{word("生成時間 P50 / P95", "かかった時間（ふつう / 長いとき）")}</dt><dd>{p50 === null || p95 === null ? "未計測" : `${p50} ms / ${p95} ms`}</dd></div>
        <div><dt>学習の数字</dt><dd>未計測</dd></div>
      </dl>

      <div>
        <label>{word("元の版", "前の教材")}
          <select value={fromNumber} onChange={(event) => setFromNumber(Number(event.target.value))}>
            {sortedVersions.map((version) => <option key={version.number} value={version.number}>{turn(version.number)}</option>)}
          </select>
        </label>
        <label>{word("比べる版", "比べる教材")}
          <select value={toNumber} onChange={(event) => setToNumber(Number(event.target.value))}>
            {sortedVersions.map((version) => <option key={version.number} value={version.number}>{turn(version.number)}</option>)}
          </select>
        </label>
      </div>

      <h3>{word("変更したところ", "変えたところ")}</h3>
      {changes.length ? <table>
        <thead><tr><th>項目</th><th>{turn(from?.number)}</th><th>{turn(to?.number)}</th></tr></thead>
        <tbody>{changes.map((change) => <tr key={change.path}>
          <th>{change.path === "strategy" ? word("戦略", "教え方") : change.path.endsWith(".hints[1]") ? "ヒント文" : change.path}</th>
          <td>{change.path === "strategy" ? STRATEGY_LABEL[change.before as StudioLesson["strategy"]] ?? change.before : change.before}</td>
          <td>{change.path === "strategy" ? STRATEGY_LABEL[change.after as StudioLesson["strategy"]] ?? change.after : change.after}</td>
        </tr>)}</tbody>
      </table> : <p>{word("選んだ版の間に変更はありません。", "選んだ回の間に変更はありません。")}</p>}

      <h3>{word("版ごとの記録", "回ごとの記録")}</h3>
      <table>
        <thead><tr><th>{word("版", "回")}</th><th>{word("戦略", "教え方")}</th><th>検査</th><th>承認の履歴・理由</th><th>{word("比較相手", "比べた相手")}</th><th>{word("生成モデル・時間", "つくった方法・時間")}</th><th>{word("データの出どころ", "データのもと")}</th></tr></thead>
        <tbody>{sortedVersions.map((version) => <tr key={version.id}>
          <th>{turn(version.number)}</th>
          <td>{STRATEGY_LABEL[version.lesson.strategy]}</td>
          <td>{version.validation.ok ? "通過" : `未通過：${version.validation.issues.join("、")}`}</td>
          <td>{version.approvalHistory?.length
            ? version.approvalHistory.map((entry) => <p key={`${entry.at}-${entry.decision}`}>{entry.at} {DECISION_LABEL[entry.decision]}：{entry.reason}</p>)
            : version.transitions.filter((status) => ["approved", "rejected", "revoked"].includes(status)).map((status) => ({ approved: "承認", rejected: "却下", revoked: "取り消し" })[status as "approved" | "rejected" | "revoked"]).join("、") || "履歴なし"}</td>
          <td>{version.comparedToVersion ? turn(version.comparedToVersion) : version.baseVersion ? turn(version.baseVersion) : "なし"}</td>
          <td>{version.generation ? `${plain && version.generation.model === "mock" ? "見本" : version.generation.model} / ${version.generation.elapsedMs} ms` : "未記録"}</td>
          <td><span>{sourceLabel(version, plain)}</span>{markedSource(version) && !(plain && sourceLabel(version, plain) === "見本") && <small>（見本）</small>}</td>
        </tr>)}</tbody>
      </table>
    </section>
  );
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  return ordered.length ? ordered[Math.ceil(fraction * ordered.length) - 1] ?? null : null;
}

function rate(numerator: number, denominator: number): string {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "未計測";
}
