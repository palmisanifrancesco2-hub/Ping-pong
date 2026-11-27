import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

AVAILABLE = all(importlib.util.find_spec(n) for n in ['torch', 'catboost', 'ngboost', 'nflows'])


@unittest.skipUnless(AVAILABLE, 'Requires isolated optional research environment')
class FrozenTransferTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('transfer', Path(__file__).with_name('evaluate-frozen-transfer.py'))
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_changed_artifact_is_rejected_before_deserialization(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'model.joblib'
            path.write_bytes(b'not a trusted pickle')
            manifest = {'artifacts': [{'file': path.name, 'sha256': '0'*64}]}
            with patch.object(self.module.joblib, 'load') as load:
                with self.assertRaisesRegex(ValueError, 'frozen benchmark manifest'):
                    self.module.verified_artifact(path, manifest)
                load.assert_not_called()

    def test_missing_manifest_or_unexpected_validation_flag_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'model.joblib'
            self.module.joblib.dump({'validated': True}, path)
            with self.assertRaisesRegex(ValueError, 'frozen benchmark manifest'):
                self.module.verified_artifact(path, {'artifacts': []})
            manifest = {'artifacts': [{'file': path.name, 'sha256': self.module.sha(path)}]}
            with self.assertRaisesRegex(ValueError, 'validation flag'):
                self.module.verified_artifact(path, manifest)


if __name__ == '__main__':
    unittest.main()
