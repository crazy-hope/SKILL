import { cp, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const version = process.argv[2];
try {
  const current = (await readFile(join(root, 'CURRENT'), 'utf8')).trim();
  if (!/^v[1-9]\d*$/.test(current) || !/^v[1-9]\d*$/.test(version || '') || Number(version.slice(1)) <= Number(current.slice(1))) throw new Error('请指定高于当前版本的新版本，例如：node workbench/create-version.mjs v2');
  const target = join(root, version);
  let exists = false;
  try { await access(target); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) throw new Error(`${version} 已存在，不能覆盖历史版本。`);
  const excluded = new Set(['node_modules', 'dist', 'test-results', '.DS_Store', '.env']);
  await cp(join(root, current), target, { recursive: true, errorOnExist: true, force: false, filter: source => !excluded.has(basename(source)) && (!basename(source).startsWith('.env.') || basename(source) === '.env.example') });
  for (const file of ['package.json', 'package-lock.json']) {
    const path = join(target, file);
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    pkg.version = `${version.slice(1)}.0.0`;
    if (pkg.packages?.['']) pkg.packages[''].version = pkg.version;
    await writeFile(path, JSON.stringify(pkg, null, 2) + '\n');
  }
  console.log(`已从 ${current} 创建 ${version}，未切换 CURRENT。\n修改并验证后，再将 workbench/CURRENT 改为 ${version}。旧版本仍可启动。`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
