import importlib.util
import io
from pathlib import Path
import tempfile
import tarfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('build_ipk',ROOT/'scripts/build_ipk.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)

class PackagingTests(unittest.TestCase):
    def test_openwrt_outer_format_and_parent_directories(self):
        with tempfile.TemporaryDirectory() as d:
            p=build.package(Path(d),'sample','all',[('www/luci-static/resources/view/warp/sample.js',b'hello',0o644)],'luci-base')
            with tarfile.open(p) as outer:
                self.assertEqual(outer.extractfile('./debian-binary').read(),b'2.0\n')
                data=outer.extractfile('./data.tar.gz').read()
            with tarfile.open(fileobj=io.BytesIO(data)) as inner:
                names=inner.getnames()
                self.assertIn('./www/luci-static/resources/view/warp',names)
                self.assertTrue(inner.getmember('./www/luci-static/resources/view/warp').isdir())
                self.assertEqual(inner.extractfile('./www/luci-static/resources/view/warp/sample.js').read(),b'hello')
    def test_deterministic_archives(self):
        entries=[('a/b',b'data',0o755)]
        self.assertEqual(build.archive(entries),build.archive(entries))
    def test_release_manifest_and_files(self):
        dist=ROOT/'dist-podkop'
        self.assertNotIn(b'\r',(dist/'SHA256SUMS').read_bytes())
        self.assertNotIn(b'\r',(dist/'FILES.sha256').read_bytes())
        for p in dist.glob('*.ipk'):
            with tarfile.open(p) as outer:
                data=outer.extractfile('./data.tar.gz').read()
            with tarfile.open(fileobj=io.BytesIO(data)) as inner:
                for member in inner.getmembers():
                    self.assertNotIn('..',Path(member.name).parts)
                    self.assertFalse(member.name.startswith('/'))
                    if member.isfile() and 'usr/libexec/warp-' in member.name:
                        self.assertTrue(member.mode & 0o100)
                    self.assertNotIn('account.json',member.name)
    def test_shell_and_frontend_syntax(self):
        import shutil,subprocess
        sh=shutil.which('sh') or r'C:\Program Files\Git\bin\bash.exe'
        paths=list((ROOT/'root/usr/libexec').glob('warp-*'))+list((ROOT/'root/etc/init.d').glob('warp*'))+[ROOT/'install-podkop.sh']
        paths += [ROOT/'tests/test_concurrency.sh', ROOT/'tests/router-coexistence.sh']
        for p in paths:
            subprocess.run([sh,'-n',str(p)],check=True,capture_output=True)
        subprocess.run(['node','--check',str(ROOT/'htdocs/luci-static/resources/view/warp/cfwarp.js')],check=True,capture_output=True)

if __name__=='__main__': unittest.main()
