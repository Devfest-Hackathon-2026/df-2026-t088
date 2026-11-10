import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE_PATH = join(ROOT, 'web/src/pages/print/locales/ja.json');
const NARRATION_SOURCE_PATH = join(ROOT, 'web/src/pages/print/narration/ja.json');
const TARGET_CODES = Object.freeze(['en', 'pt-BR', 'vi']);

export function plainJapanese(text) {
  return text.replace(/\[([^|\]]+)\|[^\]]+\]/g, '$1');
}

export function translationPayload(contents, targetLanguageCode, projectId) {
  return {
    url: `https://translation.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/locations/global:translateText`,
    headers: { 'Content-Type': 'application/json', 'x-goog-user-project': projectId },
    body: { contents, sourceLanguageCode: 'ja', targetLanguageCode, mimeType: 'text/plain' },
  };
}

export function buildLocale(source, targetCode, translations) {
  let index = 0;
  const templates = Object.fromEntries(Object.entries(source.templates).map(([id, template]) => [id, {
    title: translations[index++],
    steps: template.steps.map(() => translations[index++]),
    conclusion: translations[index++],
  }]));
  if (index !== translations.length) throw new Error('翻訳文の数が台本と一致しません');
  const label = { en: 'English', 'pt-BR': 'Português (Brasil)', vi: 'Tiếng Việt' }[targetCode];
  return { code: targetCode, label, verification: { checkedBy: null, checkedAt: null }, templates };
}

export function buildNarration(source, translations) {
  const ids = Object.keys(source.segments);
  if (ids.length !== translations.length) throw new Error('読み上げ文の数が台本と一致しません');
  return { verification: { checkedBy: null, checkedAt: null }, segments: Object.fromEntries(ids.map((id, index) => [id, translations[index]])) };
}

function getAccessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error('gcloud auth print-access-token に失敗しました。先に gcloud で認証してください。');
  return result.stdout.trim();
}

export async function translateLocale(source, targetCode, projectId, token, request = fetch) {
  const content = [];
  for (const template of Object.values(source.templates)) {
    content.push(plainJapanese(template.title), ...template.steps.map(plainJapanese), plainJapanese(template.conclusion));
  }
  const payload = translationPayload(content, targetCode, projectId);
  const response = await request(payload.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...payload.headers },
    body: JSON.stringify(payload.body),
  });
  if (!response.ok) throw new Error(`翻訳に失敗しました (${response.status})`);
  const result = await response.json();
  const translations = result.translations?.map((entry) => entry.translatedText);
  if (!Array.isArray(translations) || translations.length !== content.length || translations.some((text) => typeof text !== 'string' || !text.trim())) {
    throw new Error('翻訳サービスの応答に必要な文がありません');
  }
  return buildLocale(source, targetCode, translations);
}

export async function main() {
  const projectId = process.env.TRANSLATION_PROJECT;
  if (!projectId) throw new Error('TRANSLATION_PROJECT に翻訳先のプロジェクトを指定してください。');
  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8'));
  const narrationSource = JSON.parse(await readFile(NARRATION_SOURCE_PATH, 'utf8'));
  const token = getAccessToken();
  for (const targetCode of TARGET_CODES) {
    const locale = await translateLocale(source, targetCode, projectId, token);
    const narration = await translateStrings(Object.values(narrationSource.segments).map(plainJapanese), targetCode, projectId, token);
    const path = join(ROOT, `web/src/pages/print/locales/${targetCode}.json`);
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
    await writeFile(join(ROOT, `web/src/pages/print/narration/${targetCode}.json`), `${JSON.stringify(buildNarration(narrationSource, narration), null, 2)}\n`, 'utf8');
    console.log(`作成しました。確認前のため画面には出ません: ${targetCode}`);
  }
}

async function translateStrings(contents, targetCode, projectId, token) {
  const payload = translationPayload(contents, targetCode, projectId);
  const response = await fetch(payload.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...payload.headers },
    body: JSON.stringify(payload.body),
  });
  if (!response.ok) throw new Error(`翻訳に失敗しました (${response.status})`);
  const result = await response.json();
  const translations = result.translations?.map((entry) => entry.translatedText);
  if (!Array.isArray(translations) || translations.length !== contents.length || translations.some((text) => typeof text !== 'string' || !text.trim())) {
    throw new Error('翻訳サービスの応答に必要な文がありません');
  }
  return translations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
