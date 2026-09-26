import ipaddress
import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANAGER = (ROOT / 'root/usr/libexec/warp-manager').read_text(encoding='utf-8')
SHELL = r'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else 'sh'


def function(name):
    match = re.search(r'^' + name + r'\(\) \{.*?^\}', MANAGER, re.M | re.S)
    assert match, name
    return match.group()


class ReviewRegressionTests(unittest.TestCase):
    def test_all_candidate_pools_have_direct_route(self):
        common = (ROOT / 'root/usr/libexec/warp-common').read_text(encoding='utf-8')
        networks = [ipaddress.ip_network(x) for x in re.findall(r'\d+\.\d+\.\d+\.\d+/\d+', common)]
        autotune = (ROOT / 'root/usr/libexec/warp-autotune').read_text(encoding='utf-8')
        candidates = re.findall(r'alt_ip=(\d+\.\d+\.\d+\.\d+)', autotune)
        self.assertTrue(candidates)
        for candidate in candidates:
            self.assertTrue(any(ipaddress.ip_address(candidate) in network for network in networks), candidate)

    def test_invalid_settings_status_is_read_only(self):
        source = '\n'.join(function(name) for name in (
            'valid_uci_name', 'valid_hostname', 'valid_flag',
            'valid_uint_range', 'valid_country_list', 'valid_node_list',
            'validate_settings', 'do_status'))
        source += '''
SCOUT_JOBS=1
ACCOUNT_FILE=missing
LAST_ERROR=last_error
json_escape() { printf '%s' "$1"; }
cfg_get() { if [ "$1" = sni ]; then echo bad..host; else printf '%s' "$2"; fi; }
emit_error() { echo mutation > mutation; exit 99; }
warp_operation_busy() { return 1; }
do_status
do_status
'''
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([SHELL, '-c', source], cwd=directory, text=True,
                                    capture_output=True, check=True)
            for line in result.stdout.splitlines():
                status = json.loads(line)
                self.assertTrue(status['ok'])
                self.assertEqual(status['error_code'], 'invalid_sni')
            self.assertEqual(len(result.stdout.splitlines()), 2)
            self.assertFalse(Path(directory, 'mutation').exists())
            self.assertFalse(Path(directory, 'last_error').exists())

    def test_unregister_revokes_test_registration_and_preserves_failed_revoke(self):
        source = function('do_unregister') + '''
STATE_DIR=.; ACCOUNT_FILE=awg-account.json; AWG_CONFIG=awg.conf
BACKEND_LOG=log; DISABLED_FILE=disabled; LAST_ERROR=error
CFG_ACTUAL=; API_BIN=api; UBUS_BIN=noop
acquire_lock() { :; }; require_dependencies() { :; }; validate_settings() { :; }
account_valid() { :; }; runtime_stop() { :; }; remove_managed_network() { :; }
clear_actual_state() { :; }; noop() { :; }; emit_success() { :; }
emit_error() { exit 9; }
api() { printf '%s|%s\\n' "$2" "$3" >> calls; return FAILURE; }
touch autotune-account.json awg-account.json autotune-previous.conf
do_unregister
'''
        for failure in (0, 1):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                result = subprocess.run([SHELL, '-c', source.replace('FAILURE', str(failure))],
                                        cwd=directory, text=True, capture_output=True)
                calls = Path(directory, 'calls').read_text().splitlines()
                self.assertEqual(calls[0], './autotune-account.json|')
                self.assertEqual(Path(directory, 'autotune-account.json').exists(), bool(failure))
                self.assertEqual(Path(directory, 'autotune-previous.conf').exists(), bool(failure))
                self.assertEqual(result.returncode, 9 if failure else 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
