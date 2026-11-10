import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const COPY_PATH = join(ROOT, 'docs/submission/release-workflow.yml');
const ORIGINAL_PATH = join(ROOT, '.github/workflows/release.yml');
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('the submitted workflow copy matches .github/workflows/release.yml except its header comment', (t) => {
  // 提出用のコピーには .github/ が入らないので、元が無い場所では確かめられない
  if (!existsSync(ORIGINAL_PATH)) return t.skip('.github/workflows/release.yml がありません');
  const copy = read(COPY_PATH);
  const headerEnd = copy.indexOf('\n\n');
  assert.ok(headerEnd > 0, '冒頭のコメントと本体の間に空行がありません');
  const header = copy.slice(0, headerEnd).split('\n');
  assert.ok(header.every((line) => line.startsWith('#')), '冒頭はコメントだけにしてください');
  assert.equal(copy.slice(headerEnd + 2), read(ORIGINAL_PATH));
});
