import ja from "./locales/ja.json";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import vi from "./locales/vi.json";
import type { TemplateId } from "./types";

export type ExplanationLanguage = "ja" | "en" | "pt-BR" | "vi";
export interface ExplanationTemplate {
  title: string;
  steps: readonly string[];
  conclusion: string;
}
interface ExplanationLocale {
  code: ExplanationLanguage;
  label: string;
  verification: { checkedBy: string | null; checkedAt: string | null };
  templates: Record<TemplateId, ExplanationTemplate>;
}

export const EXPLANATION_LOCALES: Record<ExplanationLanguage, ExplanationLocale> = {
  ja: ja as ExplanationLocale,
  en: en as ExplanationLocale,
  "pt-BR": ptBR as ExplanationLocale,
  vi: vi as ExplanationLocale,
};

export const AVAILABLE_EXPLANATION_LANGUAGES = Object.values(EXPLANATION_LOCALES)
  .filter((locale) => (locale.code === "ja" || (locale.verification.checkedBy && locale.verification.checkedAt)) && missingTemplateStrings(locale).length === 0)
  .map(({ code, label }) => ({ code, label }));

export function missingTemplateStrings(locale: ExplanationLocale): string[] {
  const missing: string[] = [];
  for (const [id, template] of Object.entries(locale.templates)) {
    if (!template.title) missing.push(`${id}.title`);
    // 分数の型は説明カードを使わず、タイルの学習で解く。手順と結びの文は持たない
    if (id === "sansu-fraction-addsub") continue;
    const expectedStepCount = id === "rika-lever" ? 2 : 3;
    template.steps.forEach((step, index) => { if (!step) missing.push(`${id}.steps[${index}]`); });
    for (let index = template.steps.length; index < expectedStepCount; index++) missing.push(`${id}.steps[${index}]`);
    if (!template.conclusion) missing.push(`${id}.conclusion`);
  }
  return missing;
}

export function explanationTemplateFor(language: ExplanationLanguage, id: TemplateId): ExplanationTemplate {
  const selected = EXPLANATION_LOCALES[language];
  return missingTemplateStrings(selected).length === 0 && (language === "ja" || (selected.verification.checkedBy && selected.verification.checkedAt))
    ? selected.templates[id]
    : EXPLANATION_LOCALES.ja.templates[id];
}
