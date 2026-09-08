import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'root/usr/libexec/warp-autotune').read_text(encoding='utf-8')
FUNCTION = re.search(r'(speed_sample\(\) \{.*?\n\})', SOURCE, re.S).group(1)
SHELL = r'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else 'sh'

class SpeedTests(unittest.TestCase):
    def sample(self, response, rc=0, left=8, direction="speeds"):
        with tempfile.TemporaryDirectory() as tmp:
            script = FUNCTION + "\nWORK=.\n: > speeds\n"
            script += 'remaining() { left=' + str(left) + '; }\n'
            script += "probe_curl() { printf '%s\\n' '" + response + "'; return " + str(rc) + '; }\n'
            script += ': > uploads\nspeed_sample\ncat ' + direction + '\n'
            result = subprocess.run([SHELL, '-c', script], cwd=tmp, text=True, capture_output=True, check=True)
            return result.stdout.strip()

    def test_complete_download(self):
        self.assertEqual(self.sample('200|67108864|33554432|2.0'), '33554432')
    def test_full_time_budget(self):
        self.assertEqual(self.sample('200|8388608|1048576|8.0', 28), '1048576')
    def test_early_timeout(self):
        self.assertEqual(self.sample('200|8388608|1048576|4.0', 28), '')
    def test_http_error(self):
        self.assertEqual(self.sample('403|67108864|33554432|2.0', 22), '')
    def test_short_disconnect(self):
        self.assertEqual(self.sample('200|8388608|1048576|8.0', 18), '')
    def test_small_error_body(self):
        self.assertEqual(self.sample('200|1000|1000|1.0'), '')
    def test_missing_budget(self):
        self.assertEqual(self.sample('200|67108864|33554432|2.0', left=7), '')
    def test_complete_upload(self):
        self.assertEqual(self.sample('200|16777216|8388608|2.0', direction='uploads'), '8388608')
    def test_unacknowledged_upload(self):
        self.assertEqual(self.sample('000|8388608|1048576|8.0', 28, direction='uploads'), '')
    def test_rejected_upload(self):
        self.assertEqual(self.sample('413|16777216|8388608|2.0', 22, direction='uploads'), '')
    def test_no_data(self):
        self.assertEqual(self.sample('000|0|0|8.0', 28), '')

if __name__ == '__main__':
    unittest.main()
