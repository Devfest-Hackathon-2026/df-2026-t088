import test from 'node:test';
import assert from 'node:assert/strict';
import { NARRATION_SEGMENTS, VOICE, VOICES, buildSynthesisRequest, missingAudioFiles } from './make-narration.mjs';

test('uses only a conventional Japanese Neural2 voice and MP3 output', () => {
  assert.equal(VOICE.name, 'ja-JP-Neural2-B');
  const request = buildSynthesisRequest('こんにちは');
  assert.deepEqual(request, {
    input: { text: 'こんにちは' },
    voice: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
    audioConfig: { audioEncoding: 'MP3' },
  });
  assert.doesNotMatch(JSON.stringify(request), /Chirp|Gemini/i);
});

test('lists every absent narration MP3 by id', async () => {
  const missing = await missingAudioFiles(NARRATION_SEGMENTS, async () => false);
  assert.deepEqual(missing, Object.keys(NARRATION_SEGMENTS).map((id) => `${id}.mp3`));
});

test('accepts only safe narration ids', async () => {
  await assert.rejects(missingAudioFiles({ '../secret': 'text' }, async () => false), /使えない音声 id/);
});

test('uses only conventional Standard or Neural2 voices for each agreed language', () => {
  assert.deepEqual(Object.keys(VOICES), ['ja', 'en', 'pt-BR', 'vi']);
  for (const voice of Object.values(VOICES)) assert.match(voice.name, /-(Standard|WaveNet|Neural2)-/);
  assert.deepEqual(buildSynthesisRequest('Hello', VOICES.en).voice, VOICES.en);
  assert.deepEqual(buildSynthesisRequest('Olá', VOICES['pt-BR']).voice, VOICES['pt-BR']);
  assert.deepEqual(buildSynthesisRequest('Xin chào', VOICES.vi).voice, VOICES.vi);
});
