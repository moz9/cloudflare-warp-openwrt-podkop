'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
'require poll';
'require view';

const statusRPC = rpc.declare({ object: 'luci.warp', method: 'status' });
const actions = {};
['enable', 'disable', 'reconnect', 'check', 'attach'].forEach(function(a) {
    actions[a] = rpc.declare({ object: 'luci.warp', method: a });
});
const states = {
    not_configured: 'Ещё не настроен', registering: 'Настройка туннеля',
    interface_created: 'Туннель остановлен', interface_up: 'Интерфейс поднят',
    disabled: 'Отключён', error: 'Требуется внимание'
};
const errors = {
    pending_uci_changes: 'Сначала сохраните или отмените несохранённые изменения LuCI.',
    operation_in_progress: 'Операция уже выполняется.',
    data_plane_unavailable: 'Проверка HTTPS через WARP не прошла.',
    endpoint_scan_failed: 'Рабочий узел не найден. Попробуйте другое маскирующее имя.',
    awg_registration_failed: 'Не удалось зарегистрировать WARP.',
    podkop_section_conflict: 'Секция cfwarp уже существует с другими настройками. Она сохранена.',
    podkop_restart_failed: 'Podkop не подтвердил запуск. Проверьте его диагностику.',
    podkop_section_attached: 'Сначала удалите привязку интерфейса в Podkop.',
    dependency_missing: 'Не хватает компонента WARP. Повторите установку пакета.',
    invalid_awg_config: 'Конфигурация туннеля отсутствует или повреждена.',
    managed_interface_missing: 'Интерфейс WARP ещё не создан.',
    rollback_failed: 'Автоматический откат не завершён. Используйте резервную копию.',
    interrupted: 'Операция прервана.', worker_failed: 'Операция завершилась с ошибкой.'
};
const done = {
    started: 'Операция выполняется',
    enabled: 'WARP подключён', connected: 'WARP подключён', reconnected: 'Новый узел подключён',
    disabled: 'WARP отключён', checked: 'Доступ через WARP подтверждён',
    attached: 'Пустая секция cfwarp создана', already_attached: 'Секция cfwarp уже подключена'
};
function message(code) { return errors[code] || done[code] || code || '—'; }

return view.extend({
    load: function() { return Promise.all([statusRPC(), uci.load('warp')]); },
    run: function(action) {
        this.localBusy = true;
        this.refreshButtons();
        return actions[action]().then(L.bind(function(result) {
            if (!result || !result.ok) ui.addNotification(null, E('p', message(result && result.code)), 'error');
            return this.refresh();
        }, this)).catch(function(err) {
            ui.addNotification(null, E('p', 'Не удалось получить ответ: ' + err.message), 'error');
        }).finally(L.bind(function() { this.localBusy = false; this.refreshButtons(); }, this));
    },
    refreshButtons: function() {
        if (!this.buttons) return;
        const s = this.status || {};
        this.buttons.forEach(L.bind(function(b) {
            b.disabled = !!s.busy || !!this.localBusy ||
                (b.dataset.action === 'enable' && s.up && s.state !== 'error') ||
                (b.dataset.action === 'disable' && !s.registered) ||
                ((b.dataset.action === 'check' || b.dataset.action === 'attach') && !s.up) ||
                (b.dataset.action === 'attach' && s.podkop_attached);
        }, this));
    },
    refresh: function() {
        return statusRPC().then(L.bind(function(s) {
            this.status = s;
            const rows = [
                ['Состояние', s.busy ? 'Выполняется операция… ' + (s.started_at ? Math.max(0, Math.floor(Date.now()/1000)-Number(s.started_at)) + ' с' : '') : (states[s.state] || 'Неизвестно')],
                ['Интерфейс', s.interface || '—'],
                ['Узел подключения', s.endpoint || '—'],
                ['Секция Podkop', s.podkop_attached ? 'cfwarp — подключена' : 'Ещё не создана'],
                ['Последняя операция', message(s.job_result)],
                ['Проверка выхода', s.checked_at ? 'WARP подтверждён · ' + new Date(Number(s.checked_at) * 1000).toLocaleString() : 'Нажмите «Проверить выход»'],
                ['Узел Cloudflare / регион loc', s.colo ? s.colo + ' / ' + (s.location || '—') : '—']
            ];
            if (s.error_code) rows.push(['Ошибка', message(s.error_code)]);
            this.table.replaceChildren.apply(this.table, rows.map(function(row) {
                return E('tr', { 'class': 'tr' }, [E('td', { 'class': 'td', 'width': '35%' }, row[0]), E('td', { 'class': 'td' }, row[1])]);
            }));
            this.refreshButtons();
        }, this));
    },
    render: function(data) {
        this.status = data[0];
        this.table = E('table', { 'class': 'table' });
        this.buttons = [];
        const self = this;
        const button = function(label, action, style) {
            const b = E('button', { 'class': 'btn ' + (style || ''), 'data-action': action,
                'click': function() { return self.run(action); } }, label);
            self.buttons.push(b); return b;
        };
        const map = new form.Map('warp', 'Настройки WARP', 'После изменения параметров туннеля сохраните их и нажмите «Найти другой узел».');
        const section = map.section(form.NamedSection, 'main', 'warp');
        let o = section.option(form.Flag, 'auto_start', 'Запускать при загрузке роутера');
        o.rmempty = false;
        o = section.option(form.Value, 'sni', 'Маскирующее имя');
        o.description = 'Имя в первом маскирующем пакете AWG. Не выбирает страну выхода.';
        o.datatype = 'hostname'; o.rmempty = false;
        o = section.option(form.Value, 'exclude_countries', 'Исключить страны узлов');
        o.description = 'Например RU,BY. Фильтр относится к расположению узла, а не к региону, который определит сайт.';
        o.rmempty = false;
        o.validate = function(s, v) { return !v || /^[A-Za-z]{2}(,[A-Za-z]{2})*$/.test(v) ? true : 'Укажите двухбуквенные коды через запятую.'; };
        o = section.option(form.Value, 'mtu', 'MTU'); o.datatype = 'range(1280,1420)'; o.rmempty = false;
        o = section.option(form.Value, 'keepalive', 'Интервал поддержания связи, секунд'); o.datatype = 'range(0,65535)'; o.rmempty = false;
        return map.render().then(L.bind(function(settings) {
            const root = E('div', {}, [
                E('h2', {}, 'Cloudflare WARP'),
                E('p', {}, 'Отдельный туннель для секции Podkop. Выберите нужные сайты в секции cfwarp после подключения.'),
                this.table,
                E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:8px;margin:16px 0' }, [
                    button('Подключить', 'enable', 'cbi-button-action'),
                    button('Отключить', 'disable'),
                    button('Найти другой узел', 'reconnect'),
                    button('Проверить выход', 'check'),
                    button('Добавить секцию Podkop', 'attach')
                ]),
                E('p', {}, [E('a', { 'href': L.url('admin/services/podkop') }, 'Открыть Podkop'), ' · ',
                    E('a', { 'href': 'https://www.cloudflare.com/application/terms/', 'target': '_blank', 'rel': 'noopener noreferrer' }, 'Условия Cloudflare')]),
                E('p', {}, 'При первом подключении создаётся регистрация WARP. Отключение туннеля останавливает доступ для сайтов, направленных в него; их списки сохраняются.'),
                settings
            ]);
            this.refresh(); poll.add(L.bind(this.refresh, this), 3);
            return root;
        }, this));
    }
});
