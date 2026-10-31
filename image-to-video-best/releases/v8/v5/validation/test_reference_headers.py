"""Ensure reference headers are checked independently of manifest integrity."""
import contextlib
import hashlib
import io
import runpy
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
check = runpy.run_path(str(ROOT / 'validation/check_package.py'))['check']


class ReferenceHeaders(unittest.TestCase):
    def verify_copy(self, corrupt=None):
        with tempfile.TemporaryDirectory(prefix='itv-v4-header-') as directory:
            copied = Path(directory) / 'v4'
            shutil.copytree(ROOT, copied)
            if corrupt:
                path = copied / 'image-to-video-best/assets/learning/underwater-reference-set' / corrupt
                data = bytearray(path.read_bytes())
                data[:4] = b'BAD!'
                path.write_bytes(data)
            manifest = copied / 'SHA256SUMS'
            manifest.write_text(''.join(
                f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(copied).as_posix()}\n'
                for p in sorted(copied.rglob('*')) if p.is_file() and p != manifest))
            with contextlib.redirect_stdout(io.StringIO()) as output:
                status = check(copied)
            return status, output.getvalue()

    def test_valid_reference_images(self):
        status, output = self.verify_copy()
        self.assertEqual(status, 0, output)

    def test_corrupt_reference_png_even_with_matching_manifest(self):
        status, output = self.verify_copy('image-1.png')
        self.assertEqual(status, 1, output)
        self.assertIn('image-1.png', output)

    def test_corrupt_reference_webp_even_with_matching_manifest(self):
        status, output = self.verify_copy('image-2.webp')
        self.assertEqual(status, 1, output)
        self.assertIn('image-2.webp', output)


if __name__ == '__main__':
    unittest.main()
