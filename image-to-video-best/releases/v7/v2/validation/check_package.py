#!/usr/bin/env python3
"""Read-only checks for this independently copied release; standard library only."""
import hashlib
import re
import struct
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit


def check(release):
    release = release.resolve()
    skill = release / 'image-to-video-best'
    errors = []
    files = [p for p in release.rglob('*') if p.is_file()]
    for p in release.rglob('*'):
        if p.is_symlink():
            errors.append(f'Symlink is not a self-contained resource: {p.relative_to(release)}')
    for name in ('SKILL.md', 'agents/openai.yaml'):
        if not (skill / name).is_file():
            errors.append(f'Missing skill resource: {name}')
    checked_links = 0
    for p in files:
        if p.suffix != '.md':
            continue
        content = re.sub(r'```.*?```', '', p.read_text(encoding='utf-8'), flags=re.S)
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', content):
            target = target.strip().strip('<>')
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            resolved = (p.parent / unquote(parsed.path)).resolve()
            boundary = skill if skill in p.parents else release
            if not resolved.is_relative_to(boundary):
                errors.append(f'Link escapes package: {p.name} -> {target}')
            elif not resolved.exists():
                errors.append(f'Broken local link: {p.name} -> {target}')
            checked_links += 1
    source = skill / 'assets/cases/liquid-goddess/source.png'
    if source.is_file():
        data = source.read_bytes()
        if data[:8] != b'\x89PNG\r\n\x1a\n' or len(data) < 24:
            errors.append('Invalid PNG header')
        else:
            print('Case image dimensions:', *struct.unpack('>II', data[16:24]))
    else:
        errors.append('Missing source image')
    manifest = release / 'SHA256SUMS'
    if manifest.is_file():
        entries = {}
        for line in manifest.read_text().splitlines():
            digest, relative = line.split('  ', 1)
            target = (release / relative).resolve()
            if not target.is_relative_to(release) or relative in entries:
                errors.append(f'Invalid manifest path: {relative}')
                continue
            entries[relative] = digest
            if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                errors.append(f'Hash mismatch: {relative}')
        actual = {p.relative_to(release).as_posix() for p in files if p != manifest}
        if actual != set(entries):
            errors.append(f'Manifest inventory differs: {sorted(actual ^ set(entries))}')
        print('Manifest entries:', len(entries))
    else:
        errors.append('Missing release SHA256SUMS')
    print('Local links checked:', checked_links)
    if errors:
        for error in errors:
            print('FAIL:', error)
        return 1
    print('PASS: local resources, containment, image header, snapshot hashes')
    return 0


if __name__ == '__main__':
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    sys.exit(check(root))
