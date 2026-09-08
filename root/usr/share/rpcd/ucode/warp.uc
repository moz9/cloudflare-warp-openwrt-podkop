#!/usr/bin/ucode

'use strict';

import { popen } from 'fs';

const manager = '/usr/libexec/warp-job';

function run(action) {
	const allowed = {
		status: true,
		register: true,
		enable: true,
		disable: true,
		reconnect: true,
		unregister: true,
		check: true,
		attach: true,
	};

	if (allowed[action] !== true)
		return { ok: false, code: 'invalid_action' };

	const fd = popen(manager + (action == 'status' ? ' status' : ' start ' + action), 'r');
	if (!fd)
		return { ok: false, code: 'manager_unavailable' };

	const output = fd.read('all');
	fd.close();

	try {
		const result = json(trim(output));
		if (type(result) == 'object' && type(result.ok) == 'bool')
			return result;
	}
	catch (e) {}

	return { ok: false, code: 'invalid_manager_response' };
}

function testRun(args) {
    const fd = popen('/usr/libexec/warp-test ' + args, 'r');
    if (!fd) return { ok: false, code: 'manager_unavailable' };
    const output = fd.read('all');
    fd.close();
    try {
        const result = json(trim(output));
        if (type(result) == 'object' && type(result.ok) == 'bool') return result;
    } catch (e) {}
    return { ok: false, code: 'invalid_manager_response' };
}

function autoRun(args) {
    const fd = popen('/usr/libexec/warp-autotune ' + args, 'r');
    if (!fd) return { ok: false, code: 'manager_unavailable' };
    const output = fd.read('all');
    fd.close();
    try {
        const result = json(trim(output));
        if (type(result) == 'object' && type(result.ok) == 'bool') return result;
    } catch (e) {}
    return { ok: false, code: 'invalid_manager_response' };
}

const autoMethods = {
    autotune_status: { call: function() { return autoRun('status'); } },
    autotune_stop: { call: function() { return autoRun('stop'); } },
    autotune_apply: { args: { candidate: 0 }, call: function(request) {
        const c=request.args.candidate;
        if (c < 1 || c > 6 || int(c) != c) return {ok:false,code:'invalid_candidate'};
        return autoRun('apply ' + c);
    } },
    autotune_start: { args: { minutes:15, services:'' }, call: function(request) {
        const m=request.args.minutes, s=request.args.services;
        if (m != 5 && m != 15 && m != 30 && m != 45 && m != 60) return {ok:false,code:'invalid_duration'};
        if (type(s) != 'string' || length(s)>128 || !match(s,/^[a-z_,]+$/)) return {ok:false,code:'invalid_selection'};
        return autoRun('start ' + m + ' ' + s);
    } }
};
const methods = {
    ...autoMethods,
    test_status: { call: function() { return testRun('status'); } },
    test_stop: { call: function() { return testRun('stop'); } },
    test_start: {
        args: { minutes: 15, services: '' },
        call: function(request) {
            const m = request.args.minutes;
            const s = request.args.services;
            if (m != 15 && m != 30 && m != 45 && m != 60)
                return { ok: false, code: 'invalid_duration' };
            if (type(s) != 'string' || length(s) > 128 || !match(s, /^[a-z_,]+$/))
                return { ok: false, code: 'invalid_selection' };
            return testRun('start ' + m + ' ' + s);
        }
    },
	check: { call: function() { return run('check'); } },
	attach: { call: function() { return run('attach'); } },
	status: {
		call: function() {
			return run('status');
		}
	},
	register: {
		args: { accept_terms: false },
		call: function(request) {
			if (request.args.accept_terms !== true)
				return { ok: false, code: 'terms_not_accepted' };
			return run('register');
		}
	},
	enable: {
		call: function() {
			return run('enable');
		}
	},
	disable: {
		call: function() {
			return run('disable');
		}
	},
	reconnect: {
		call: function() {
			return run('reconnect');
		}
	},
	unregister: {
		call: function() {
			return run('unregister');
		}
	}
};

return { 'luci.warp': methods };
