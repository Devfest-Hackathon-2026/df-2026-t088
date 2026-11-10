import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocale, plainJapanese, translationPayload, translateLocale } from './make-translations.mjs';

test('builds Cloud Translation v3 requests with the selected billing project', () => {
  const request = translationPayload(['てこの はたらき'], 'en', 'project-id');
  assert.equal(request.url, 'https://translation.googleapis.com/v3/projects/project-id/locations/global:translateText');
  assert.equal(request.headers['x-goog-user-project'], 'project-id');
  assert.deepEqual(request.body, { contents: ['てこの はたらき'], sourceLanguageCode: 'ja', targetLanguageCode: 'en', mimeType: 'text/plain' });
});

test('removes Japanese reading annotations before sending text for translation', () => {
  assert.equal(plainJapanese('[右|みぎ]の [月|つき]'), '右の 月');
});

test('generated locale has every template string and remains unverified', () => {
  const source = { templates: { 'rika-moon': { title: '月', steps: ['満月', '半月'], conclusion: '月の説明' } } };
  const locale = buildLocale(source, 'vi', ['Mặt trăng', 'Trăng tròn', 'Bán nguyệt', 'Giải thích']);
  assert.deepEqual(locale.templates['rika-moon'], { title: 'Mặt trăng', steps: ['Trăng tròn', 'Bán nguyệt'], conclusion: 'Giải thích' });
  assert.deepEqual(locale.verification, { checkedBy: null, checkedAt: null });
});

test('uses an injected request and never needs live Google access in tests', async () => {
  let called = false;
  const locale = await translateLocale({ templates: { 'rika-lever': { title: 'てこ', steps: ['右'], conclusion: '説明' } } }, 'en', 'p', 'token', async (_url, init) => {
    called = true;
    assert.equal(init.headers['x-goog-user-project'], 'p');
    return { ok: true, json: async () => ({ translations: [{ translatedText: 'Lever' }, { translatedText: 'Right' }, { translatedText: 'Description' }] }) };
  });
  assert.equal(called, true);
  assert.equal(locale.templates['rika-lever'].steps[0], 'Right');
});
