import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('versions', Path(__file__).with_name('versions.py'))
versions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(versions)

class VersionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name, text in {'README.md':'project', 'AGENTS.md':'rules', 'Agent.md':'entry', 'CHANGELOG.md':'history', 'VERSIONING.md':'guide', 'web/app.js':'app', 'web/.env.example':'LLM_API_KEY=', 'web/.env':'DO_NOT_COPY', 'web/.local-connection.json':'DO_NOT_COPY', 'v1/SKILL.md':'skill', 'docs/design.md':'design', 'scripts/versions.py':'script'}.items():
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    def test_snapshot_is_complete_private_files_excluded_and_cannot_overwrite(self):
        dest=versions.snapshot(self.root,'v1','first')
        self.assertTrue((dest/'web/app.js').is_file())
        self.assertTrue((dest/'v1/SKILL.md').is_file())
        self.assertTrue((dest/'web/.env.example').is_file())
        self.assertFalse((dest/'web/.env').exists())
        self.assertFalse((dest/'web/.local-connection.json').exists())
        versions.verify(dest)
        with self.assertRaises(ValueError):versions.snapshot(self.root,'v1','overwrite')
    def test_changed_and_extra_files_are_detected(self):
        dest=versions.snapshot(self.root,'v1','first')
        (dest/'web/app.js').write_text('changed')
        with self.assertRaises(ValueError):versions.verify(dest)
        (dest/'web/app.js').write_text('app')
        (dest/'extra.txt').write_text('extra')
        with self.assertRaises(ValueError):versions.verify(dest)
    def test_sequence_old_integrity_and_frozen_source_are_enforced(self):
        with self.assertRaises(ValueError):versions.snapshot(self.root,'v2','skip')
        dest=versions.snapshot(self.root,'v1','first')
        with self.assertRaises(ValueError):versions.snapshot(dest,'v1','nested')
        (dest/'README.md').write_text('tampered')
        with self.assertRaises(ValueError):versions.snapshot(self.root,'v2','second')
    def test_symlinks_and_path_escape_are_rejected(self):
        (self.root/'web/link').symlink_to('/tmp')
        with self.assertRaises(ValueError):versions.snapshot(self.root,'v1','symlink')
        self.assertFalse((self.root/'releases/v1').exists())
        with self.assertRaises(ValueError):versions.snapshot(self.root,'../outside','escape')

if __name__=='__main__':unittest.main()
