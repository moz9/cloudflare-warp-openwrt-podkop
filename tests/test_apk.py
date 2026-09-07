"""Verify that APK v2 metadata authenticates exactly the corresponding IPK payload."""
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_ipk', ROOT / 'scripts/build_ipk.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class ApkTests(unittest.TestCase):
    def test_payload_identity_and_checksums(self):
        for name, version, arch in [
            ('warp-awg', build.BACKEND_VERSION, 'aarch64_cortex-a53'),
            ('warp-warpscout', build.BACKEND_VERSION, 'aarch64_cortex-a53'),
            ('luci-app-warp', build.VERSION, 'all'),
        ]:
            with self.subTest(package=name):
                apk = (ROOT / 'dist-apk' / f'{name}-{version}-r1.apk').read_bytes()
                decoder = zlib.decompressobj(31)
                control = decoder.decompress(apk)
                data = decoder.unused_data
                with tarfile.open(fileobj=io.BytesIO(control)) as t:
                    info = t.extractfile('.PKGINFO').read().decode()
                self.assertIn(f'datahash = {hashlib.sha256(data).hexdigest()}\n', info)
                self.assertIn(f'arch = {"noarch" if arch == "all" else arch}\n', info)
                with tarfile.open(ROOT / 'dist-podkop' / f'{name}_{version}_{arch}.ipk') as t:
                    ipk_data = t.extractfile('./data.tar.gz').read()
                with tarfile.open(fileobj=io.BytesIO(ipk_data)) as t:
                    expected = {e.name.removeprefix('./'): (t.extractfile(e).read(), e.mode)
                                for e in t if e.isfile()}
                with tarfile.open(fileobj=io.BytesIO(data)) as t:
                    actual = {}
                    for e in t:
                        if not e.isfile():
                            continue
                        body = t.extractfile(e).read()
                        self.assertEqual(e.pax_headers['APK-TOOLS.checksum.SHA1'], hashlib.sha1(body).hexdigest())
                        actual[e.name] = (body, e.mode)
                self.assertEqual(actual, expected)


if __name__ == '__main__':
    unittest.main()
