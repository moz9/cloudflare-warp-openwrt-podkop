import pathlib, shutil, subprocess, tempfile, unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
AWK=shutil.which('awk') or r'C:\Program Files\Git\usr\bin\awk.exe'

class StabilityScore(unittest.TestCase):
    def score(self, samples):
        with tempfile.TemporaryDirectory() as tmp:
            path=pathlib.Path(tmp)/'samples'
            path.write_text(samples,encoding='utf-8')
            output=subprocess.check_output([AWK,"-F|",'-f',str(ROOT/'root/usr/share/warp-test/score.awk'),str(path)],text=True)
        return {line.split('|')[0]:line.split('|')[1:] for line in output.splitlines()}

    def test_network_errors_are_not_authentication_restrictions(self):
        result=self.score('chatgpt|restricted|100|0|403|0\nchatgpt|network|8000|28|000|0\nchatgpt|dns|0|6|000|0\nchatgpt|ok|200|0|200|0\n')
        self.assertEqual(result['chatgpt'],['4','1','1','1','1','0','100','200','ok','200'])

    def test_percentiles_and_service_isolation(self):
        samples=''.join(f'youtube|ok|{n}|0|204|0\n' for n in range(1,101))
        samples+='google|http|500|0|500|0\n'
        result=self.score(samples)
        self.assertEqual(result['youtube'][6:8],['50','95'])
        self.assertEqual(result['google'][0:6],['1','0','0','0','0','1'])

    def test_no_samples_is_not_a_pass(self):
        self.assertEqual(self.score(''),{})

if __name__=='__main__':unittest.main()
