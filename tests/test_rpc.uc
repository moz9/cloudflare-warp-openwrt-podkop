// Run with ucode on OpenWrt. Read-only: no valid test start/stop is issued.
const m = loadfile(ARGV[0] || '/usr/share/rpcd/ucode/warp.uc')()['luci.warp'];
function check(value, name) {
    if (!value) { warn('FAIL ' + name + '\n'); exit(1); }
}
check(m.test_status.call().ok === true, 'test_status runtime closure');
check(m.test_start.call({args:{minutes:5,services:'youtube'}}).code === 'invalid_duration', 'duration validation');
check(m.test_start.call({args:{minutes:15,services:'youtube;id'}}).code === 'invalid_selection', 'RPC argument injection');
check(m.test_start.call({args:{minutes:15,services:''}}).code === 'invalid_selection', 'empty selection');
print('PASS: RPC runtime closure and input validation\n');
