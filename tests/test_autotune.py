import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'root/usr/libexec/warp-autotune').read_text()
PROGRAM = re.search(r"awk -F'\|'[^\n]*? '(.*?)' \"\$WORK/results\"", SOURCE, re.S).group(1)
AWK = shutil.which('awk') or r'C:\Program Files\Git\usr\bin\awk.exe'


def rank(rows, limited=False):
    result = subprocess.run([AWK, '-F|', '-v', 'limited='+str(int(limited)), PROGRAM], input='\n'.join(rows)+'\n',
                            text=True, capture_output=True, check=True)
    return [line.split('|')[1] for line in sorted(result.stdout.splitlines(), reverse=True)]


class AutotuneRankingTests(unittest.TestCase):
    def test_server_limit_removes_speed_advantage(self):
        self.assertEqual(rank([
            '1|ep|6|12|12|0|0|500|90000000|3|0|3|90000000|2|2',
            '2|ep|12|12|12|0|0|100|1000000|3|0|3|1000000|2|2'], limited=True)[0], '2')

    def test_balanced_throughput_beats_download_only_peak(self):
        self.assertEqual(rank([
            '1|ep|6|12|12|0|0|500|10000000|3|0|3|10000000|2|2',
            '2|ep|12|12|12|0|0|100|20000000|3|0|3|1000000|2|2'])[0], '1')

    def test_single_sample_cannot_beat_complete_measurements(self):
        self.assertEqual(rank([
            '1|ep|6|12|12|0|0|500|1000000|3|0|3|1000000|2|2',
            '2|ep|12|12|12|0|0|100|90000000|3|0|3|90000000|1|1'])[0], '1')

    def test_fast_broken_tunnel_cannot_beat_stable(self):
        self.assertEqual(rank([
            '1|ep|6|12|12|0|0|500|1000000|3|0|3',
            '2|ep|12|12|12|0|0|100|9000000|3|1|3'])[0], '1')

    def test_availability_precedes_speed(self):
        self.assertEqual(rank([
            '1|ep|6|12|12|0|0|500|1000000|3|0|3',
            '2|ep|12|12|6|6|0|100|9000000|3|0|3'])[0], '1')

    def test_incomplete_fast_sample_is_not_recommended(self):
        self.assertEqual(rank([
            '1|ep|6|12|10|2|0|500|1000000|3|0|3',
            '2|ep|12|4|4|0|0|100|9000000|1|0|1'])[0], '1')


if __name__ == '__main__':
    unittest.main()
