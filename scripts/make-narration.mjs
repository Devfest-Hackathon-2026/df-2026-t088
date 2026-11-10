import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const NARRATION_DIR = join(ROOT, 'web/src/pages/print/narration');
const OUTPUT_DIR = join(ROOT, 'web/public/narration');
export const VOICES = Object.freeze({
  ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
  en: { languageCode: 'en-US', name: 'en-US-Neural2-C' },
  'pt-BR': { languageCode: 'pt-BR', name: 'pt-BR-Standard-A' },
  vi: { languageCode: 'vi-VN', name: 'vi-VN-Standard-A' },
});
export const VOICE = VOICES.ja;
const SEGMENTS_PATH = join(NARRATION_DIR, 'ja.json');
export const NARRATION_SEGMENTS = Object.freeze(JSON.parse(readFileSync(SEGMENTS_PATH, 'utf8')).segments);

export function buildSynthesisRequest(text, voice = VOICE) {
  return {
    input: { text },
    voice: { ...voice },
    audioConfig: { audioEncoding: 'MP3' },
  };
}

export async function missingAudioFiles(segments, exists) {
  const missing = [];
  for (const id of Object.keys(segments)) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`使えない音声 id です: ${id}`);
    if (!(await exists(`${id}.mp3`))) missing.push(`${id}.mp3`);
  }
  return missing;
}

async function accessToken() {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error('gcloud auth print-access-token に失敗しました。先に gcloud で認証してください。');
  }
  return result.stdout.trim();
}

async function synthesize(id, text, token, voice = VOICE, outputDir = OUTPUT_DIR) {
  const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(process.env.NARRATION_PROJECT ? { 'x-goog-user-project': process.env.NARRATION_PROJECT } : {}) },
    body: JSON.stringify(buildSynthesisRequest(text, voice)),
  });
  if (!response.ok) throw new Error(`${id}: 音声の作成に失敗しました (${response.status})`);
  const result = await response.json();
  if (typeof result.audioContent !== 'string') throw new Error(`${id}: 音声データがありません`);
  await writeFile(join(outputDir, `${id}.mp3`), Buffer.from(result.audioContent, 'base64'));
}

export async function main() {
  const language = process.argv.find((value, index) => process.argv[index - 1] === '--language') ?? 'ja';
  const voice = VOICES[language];
  if (!voice) throw new Error(`使えない音声言語です: ${language}`);
  const narration = JSON.parse(await readFile(join(NARRATION_DIR, `${language}.json`), 'utf8'));
  if (language !== 'ja' && (!narration.verification.checkedBy || !narration.verification.checkedAt)) {
    throw new Error('人が確認した読み上げ台本だけ音声にできます');
  }
  const segments = narration.segments;
  const outputDir = language === 'ja' ? OUTPUT_DIR : join(OUTPUT_DIR, language);
  await mkdir(outputDir, { recursive: true });
  if (process.argv.includes('--check')) {
    const missing = await missingAudioFiles(segments, async (name) => {
      try { await readFile(join(outputDir, name)); return true; } catch { return false; }
    });
    if (missing.length) throw new Error(`音声ファイルがありません:\n${missing.map((name) => `- ${name}`).join('\n')}`);
    console.log(`音声ファイルをすべて確認しました (${Object.keys(segments).length} 件)`);
    return;
  }
  const token = await accessToken();
  for (const [id, text] of Object.entries(segments)) {
    await synthesize(id, text, token, voice, outputDir);
    console.log(`作成しました: ${id}.mp3`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
