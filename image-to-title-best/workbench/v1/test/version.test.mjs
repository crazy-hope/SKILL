import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, access, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
test('new workbench versions preserve sources, exclude private/generated files and never overwrite or activate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'title-release-'));
  try {
    await copyFile(fileURLToPath(new URL('../../create-version.mjs', import.meta.url)), join(root, 'create-version.mjs'));
    await writeFile(join(root, 'CURRENT'), 'v1\n');
    await mkdir(join(root, 'v1/node_modules'), { recursive: true });
    await mkdir(join(root, 'v1/dist'));
    await writeFile(join(root, 'v1/.env'), 'TEST_NOT_REAL=private');
    await writeFile(join(root, 'v1/main.jsx'), 'source');
    await writeFile(join(root, 'v1/package.json'), '{"version":"1.0.0"}');
    await writeFile(join(root, 'v1/package-lock.json'), '{"version":"1.0.0","packages":{"":{"version":"1.0.0"}}}');
    await exec(process.execPath, [join(root, 'create-version.mjs'), 'v2']);
    assert.equal(await readFile(join(root, 'CURRENT'), 'utf8'), 'v1\n');
    assert.equal(await readFile(join(root, 'v2/main.jsx'), 'utf8'), 'source');
    assert.equal(JSON.parse(await readFile(join(root, 'v2/package-lock.json'), 'utf8')).packages[''].version, '2.0.0');
    for (const file of ['node_modules', 'dist', '.env']) await assert.rejects(access(join(root, 'v2', file)));
    await assert.rejects(exec(process.execPath, [join(root, 'create-version.mjs'), 'v2']));
    await assert.rejects(exec(process.execPath, [join(root, 'create-version.mjs'), '../v3']));
    assert.equal(await readFile(join(root, 'v1/package.json'), 'utf8'), '{"version":"1.0.0"}');
  } finally { await rm(root, { recursive: true, force: true }); }
});
