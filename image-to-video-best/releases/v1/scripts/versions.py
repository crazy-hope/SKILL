#!/usr/bin/env python3
"""Local immutable project snapshots. No credentials, Git operations or network."""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOP_FILES = ('README.md', 'AGENTS.md', 'Agent.md', 'CHANGELOG.md', 'VERSIONING.md', '.gitignore')
SKIP_DIRS = {'.git', '.codex', '.agents', 'node_modules', '__pycache__', 'coverage', '.pytest_cache'}

def excluded(path):
    name = path.name
    return (name in SKIP_DIRS or name == '.DS_Store' or
            (name.startswith('.env') and name != '.env.example') or
            name.startswith('.local-connection') or
            path.suffix in {'.log', '.pyc', '.pem', '.key', '.p12'})

def files_under(root):
    for path in sorted(root.iterdir()):
        if excluded(path):
            continue
        if path.is_symlink():
            raise ValueError(f'Symlinks are not allowed: {path.name}')
        if path.is_dir():
            yield from files_under(path)
        elif path.is_file():
            yield path
        else:
            raise ValueError(f'Unsupported file type: {path.name}')

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def verify(root):
    root = Path(root).absolute()
    if root.is_symlink():
        raise ValueError('Snapshot root cannot be a symlink')
    manifest = root / 'SHA256SUMS'
    if manifest.is_symlink():
        raise ValueError('Manifest cannot be a symlink')
    expected = {}
    for line in manifest.read_text().splitlines():
        checksum, name = line.split('  ', 1)
        relative = Path(name)
        if (not re.fullmatch('[0-9a-f]{64}', checksum) or relative.is_absolute() or
                '..' in relative.parts or name in expected or name == 'SHA256SUMS'):
            raise ValueError('Invalid snapshot manifest')
        expected[name] = checksum
    # Unlike source packing, verification also catches unexpected secret/cache files.
    actual = set()
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Snapshot contains a symlink')
        if path.is_file() and path != manifest:
            actual.add(path.relative_to(root).as_posix())
    if actual != set(expected):
        raise ValueError('Snapshot file list changed')
    for name, checksum in expected.items():
        if digest(root / name) != checksum:
            raise ValueError(f'Snapshot content changed: {name}')
    return len(expected)

def snapshot(root, version, reason):
    root = Path(root).resolve()
    if (root / 'SNAPSHOT.json').exists():
        raise ValueError('Cannot create versions inside a frozen snapshot')
    if not re.fullmatch(r'v[1-9][0-9]*', version) or not reason.strip():
        raise ValueError('Use v1, v2, ... and a nonempty reason')
    releases = root / 'releases'
    if releases.is_symlink():
        raise ValueError('Release directory cannot be a symlink')
    releases.mkdir(exist_ok=True)
    existing = sorted((p for p in releases.iterdir() if re.fullmatch(r'v[1-9][0-9]*', p.name)), key=lambda p: int(p.name[1:]))
    if [p.name for p in existing] != [f'v{i}' for i in range(1, len(existing) + 1)]:
        raise ValueError('Release history is not sequential')
    if version != f'v{len(existing) + 1}':
        raise ValueError('Cannot overwrite or skip a version')
    for previous in existing:
        verify(previous)
    sources = []
    for name in TOP_FILES:
        path = root / name
        if path.exists():
            if path.is_symlink():
                raise ValueError('Source files cannot be symlinks')
            sources.append(path)
    directories = [root / name for name in ('web', 'docs', 'scripts')]
    directories += sorted(p for p in root.iterdir() if re.fullmatch(r'v[1-9][0-9]*', p.name))
    for directory in directories:
        if directory.is_symlink():
            raise ValueError('Source directories cannot be symlinks')
        if directory.is_dir():
            sources.extend(files_under(directory))
    required = ('AGENTS.md', 'Agent.md', 'CHANGELOG.md', 'VERSIONING.md', 'README.md')
    if any(root / name not in sources for name in required):
        raise ValueError('Missing required maintenance records')
    temporary = Path(tempfile.mkdtemp(prefix='.draft-', dir=releases))
    try:
        for source in sources:
            target = temporary / source.relative_to(root)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        metadata = {'version': version, 'created_at_utc': datetime.now(timezone.utc).isoformat(),
                    'reason': reason, 'scope': 'Complete project source snapshot; credentials excluded',
                    'previous': existing[-1].name if existing else None}
        (temporary / 'SNAPSHOT.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
        (temporary / 'RELEASE.md').write_text(f'# 项目快照 {version}\n\n{reason}\n\n完整变更见 CHANGELOG.md，维护规则见 AGENTS.md。\n\n在此目录运行 `npm start --prefix web`；需独立配置密钥，可在 web/.env 设置其他端口。\n\n本目录已冻结，后续修改在项目工作目录进行。不得重算本版清单来掩盖改动。\n')
        entries = sorted(p for p in temporary.rglob('*') if p.is_file())
        (temporary / 'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.relative_to(temporary).as_posix()}\n' for p in entries))
        verify(temporary)
        destination = releases / version
        if destination.exists():
            raise ValueError('Destination already exists')
        temporary.rename(destination)
        return destination
    except BaseException:
        shutil.rmtree(temporary, ignore_errors=True)
        raise

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('snapshot')
    create.add_argument('version')
    create.add_argument('--reason', required=True)
    check = commands.add_parser('verify')
    check.add_argument('path', type=Path)
    args = parser.parse_args()
    try:
        if args.command == 'snapshot':
            print(snapshot(ROOT, args.version, args.reason))
        else:
            print(f'PASS: {verify(args.path)} files unchanged')
    except (ValueError, OSError) as error:
        parser.exit(1, f'ERROR: {error}\n')

if __name__ == '__main__':
    main()
