'use strict';
'require form';
'require rpc';
'require uci';
'require ui';
'require poll';
'require view';

const statusRPC = rpc.declare({ object: 'luci.warp', method: 'status' });
const testStatusRPC = rpc.declare({ object: 'luci.warp', method: 'test_status' });
const testStartRPC = rpc.declare({ object: 'luci.warp', method: 'test_start', params: ['minutes', 'services'] });
const testStopRPC = rpc.declare({ object: 'luci.warp', method: 'test_stop' });
const autoStatusRPC = rpc.declare({object:'luci.warp',method:'autotune_status'});
const autoStartRPC = rpc.declare({object:'luci.warp',method:'autotune_start',params:['minutes','services']});
const autoStopRPC = rpc.declare({object:'luci.warp',method:'autotune_stop'});
const autoApplyRPC = rpc.declare({object:'luci.warp',method:'autotune_apply',params:['candidate']});
const testProfiles = [
    ['google', 'Google', true], ['google_ai', 'Google AI / Gemini', true],
    ['chatgpt', 'ChatGPT / OpenAI', true], ['youtube', 'YouTube', true],
    ['google_play', 'Google Play', false], ['discord', 'Discord', false],
    ['telegram', 'Telegram', false], ['cloudflare', 'Cloudflare', false]
];
const testColumns = ['Сервис','Успешные HTTP','Ограничения / вход','Ошибки','Задержка: обычная / 95%','Последний ответ'];
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
    precheck_failed:'Узел не прошёл предварительную проверку или фильтры.',
    proxy_start_failed:'Тестовый туннель не запустился.',
    low_memory:'Недостаточно свободной памяти для отдельного тестового туннеля.',
    test_port_busy:'Тестовый порт занят. Другой процесс сохранён.',
    registering_test_account:'Подготовка отдельной тестовой регистрации',
    registration_failed:'Не удалось подготовить тестовую регистрацию WARP.',
    configuration_changed:'Настройки WARP изменились. Запустите подбор заново.',
    incomplete_test:'Сначала завершите полный подбор.',
    unqualified_candidate:'Недостаточно успешных проверок этого варианта.',
    candidate_failed_rolled_back:'Выбранный вариант не прошёл проверку. Прежний восстановлен.',
    pending_uci_changes: 'Сначала сохраните или отмените несохранённые изменения LuCI.',
    operation_in_progress: 'Операция уже выполняется.',
    podkop_busy: 'Podkop обновляет подписки или DNS. Повторите после завершения операции.',
    test_busy: 'Проверка уже выполняется.',
    invalid_duration: 'Выберите 15, 30, 45 или 60 минут.',
    invalid_selection: 'Выберите хотя бы один сервис.',
    data_plane_unavailable: 'Проверка HTTPS через WARP не прошла.',
    scan_route_failed: 'Не удалось подготовить прямую проверку узлов WARP.',
    scan_route_cleanup_failed: 'Не удалось удалить временное правило проверки WARP.',
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
    renderAutotune: function() {
        this.autoExpanded=new Set();
        this.autoChoices=testProfiles.map(p=>E('input',{type:'checkbox',value:p[0],checked:p[2]||null}));
        this.autoDuration=E('select',{'aria-label':'Время всего подбора'},[15,30,45,60].map(m=>E('option',{value:m},m+' минут')));
        this.autoProgress=E('p',{'aria-live':'polite'},'Подбор ещё не запускался.');
        this.autoRows=E('tbody');
        this.autoStart=E('button',{class:'btn cbi-button-action',click:()=>this.autoAction(()=>autoStartRPC(Number(this.autoDuration.value),this.autoChoices.filter(c=>c.checked).map(c=>c.value).join(',')))},'Начать автоподбор');
        this.autoStop=E('button',{class:'btn',disabled:true,click:()=>this.autoAction(autoStopRPC)},'Остановить подбор');
        return E('div',{},[
            E('h2',{},'Автоподбор CF WARP'),
            E('p',{},'Сравнивает шесть вариантов узла, порта и количества маскирующих пакетов через отдельный тестовый WARP. Рабочее подключение и списки Podkop сохраняются. Выбранное время относится ко всему подбору.'),
            E('div',{style:'display:flex;flex-wrap:wrap;gap:16px;margin:16px 0'},testProfiles.map((p,i)=>E('label',{},[this.autoChoices[i],' '+p[1]]))),
            E('div',{style:'display:flex;flex-wrap:wrap;gap:12px'},[this.autoDuration,this.autoStart,this.autoStop]),
            this.autoProgress,
            E('div',{style:'overflow-x:auto'},E('table',{class:'table warp-test-table'},[
                E('thead',{},E('tr',{},['Вариант','Доступность','Обрывы WARP','Скорость','Задержка 95%','Действие'].map(t=>E('th',{},t)))),this.autoRows
            ])),
            E('p',{},'Рейтинг учитывает успешные ответы выбранных сервисов, ошибки, затем скорость и задержку. Для применения нужны минимум три круга и подтверждения WARP без обрывов. 403 не считается успехом. Скорость — ориентир по двум файлам по 1 МиБ на вариант (до 12 МиБ за подбор), не предел канала и не скорость YouTube.'),
            E('p',{},'Исходный вариант отмечен в таблице; остальные сравниваются с ним. MTU и маскирующее имя в этом подборе не перебираются. Применение выбранного варианта может кратко прервать WARP; при неудачной проверке прежний вариант возвращается.')
        ]);
    },
    autoAction: function(fn) {
        this.autoPending=true; this.autoStart.disabled=true; this.autoStop.disabled=true;
        return fn().then(r=>{if(!r||!r.ok) ui.addNotification(null,E('p',message(r&&r.code)),'error');
            else if(['applied','already_applied'].includes(r.code)) ui.addNotification(null,E('p','Вариант применён и проверен.'),'info');
        }).catch(e=>ui.addNotification(null,E('p',e.message),'error')).finally(()=>{this.autoPending=false;this.refreshAuto();});
    },
    refreshAuto: function() {
        if(!this.autoProgress)return Promise.resolve();
        return autoStatusRPC().then(s=>{
            const running=['running','stopping'].includes(s.state);
            const labels={idle:'Подбор ещё не запускался',running:'Подбор идёт',stopping:'Останавливается',complete:'Подбор завершён',stopped:'Подбор остановлен',interrupted:'Подбор прерван',changed:'Рабочая конфигурация изменилась',error:'Подбор завершился с ошибкой'};
            this.autoProgress.textContent=(labels[s.state]||s.state)+(s.minutes?' · вариант '+(s.current||0)+' из 6 · '+Math.floor((s.elapsed||0)/60)+' из '+s.minutes+' мин':'')+(s.reason?' · '+message(s.reason):'');
            this.autoStart.disabled=running||!!this.autoPending;this.autoStop.disabled=!running||!!this.autoPending;this.autoDuration.disabled=running;
            this.autoChoices.forEach(c=>{c.disabled=running;if(running)c.checked=(','+s.selection+',').includes(','+c.value+',');});
            const cols=['Вариант','Доступность','Обрывы WARP','Скорость','Задержка 95%','Действие'];
            this.autoRows.replaceChildren(...(s.candidates||[]).map((c,index)=>{
                const eligible=s.state==='complete'&&c.checks>=3&&c.failures===0&&c.rounds>=3&&c.good>0;
                const apply=E('button',{class:'btn',disabled:!eligible||!!this.autoPending,click:()=>this.autoAction(()=>autoApplyRPC(c.id))},'Применить');
                const details=E('details',{open:this.autoExpanded.has(c.id)||null},[
                    E('summary',{},'По сервисам'),...(c.services||[]).map(v=>{
                        const profile=testProfiles.find(p=>p[0]===v.id);
                        return E('p',{},(profile?profile[1]:v.id)+': '+v.good+' / '+v.total+' · ограничений '+v.restricted+' · ошибок '+v.errors);
                    })
                ]);
                details.addEventListener('toggle',()=>{if(details.open)this.autoExpanded.add(c.id);else this.autoExpanded.delete(c.id);});
                const availability=E('div',{},[E('span',{},c.total?c.good+' / '+c.total+' · ограничений '+c.restricted+' · ошибок '+c.errors:message(c.note)),...(c.total?[details]:[])]);
                const values=[(index+1)+'. '+c.endpoint+' · пакетов '+c.jc+(c.id===1?' (исходный)':''),availability,c.checks?c.failures+' / '+c.checks:'Нет проверок',(c.speed*8/1000000).toFixed(2)+' Мбит/с',c.p95+' мс',apply];
                return E('tr',{},values.map((v,i)=>E('td',{'data-label':cols[i]},v)));
            }));
        }).catch(()=>{});
    },
    renderTester: function() {
        this.testChoices = testProfiles.map(function(p) {
            return E('input', { type: 'checkbox', value: p[0], checked: p[2] || null });
        });
        this.testDuration = E('select', { 'aria-label': 'Продолжительность проверки' }, [15,30,45,60].map(function(m) {
            return E('option', {value: String(m)}, m + ' минут');
        }));
        this.testProgress = E('p', {'aria-live': 'polite'}, 'Проверка ещё не запускалась.');
        this.testRows = E('tbody');
        this.testStart = E('button', {class:'btn cbi-button-action', click:L.bind(function() {
            const selection = this.testChoices.filter(function(c) {return c.checked;}).map(function(c) {return c.value;}).join(',');
            if (!selection) {ui.addNotification(null, E('p', errors.invalid_selection), 'error'); return;}
            return this.testAction(function() {return testStartRPC(Number(this.testDuration.value), selection);}.bind(this));
        },this)}, 'Начать проверку');
        this.testStop = E('button', {class:'btn', disabled:true, click:L.bind(function() {
            return this.testAction(testStopRPC);
        },this)}, 'Остановить');
        return E('div', {}, [
            E('style',{},'@media(max-width:600px){.warp-test-table td::before{content:attr(data-label);display:block;font-weight:600;opacity:.7;margin-bottom:3px}}'),
            E('h2', {}, 'Проверка стабильности CF WARP'),
            E('p', {}, 'Проверяет текущий узел в течение выбранного времени. Работает в фоне при закрытой странице, не меняет списки Podkop и не перезапускает службы.'),
            E('p', {}, 'Профили соответствуют крупным сервисам из списков Podkop; Google и ChatGPT — дополнительные профили. Проверяются основные адреса, а не каждый домен списка.'),
            E('div', {style:'display:flex;flex-wrap:wrap;gap:16px;margin:16px 0'}, testProfiles.map(L.bind(function(p,i) {
                return E('label', {style:'display:flex;gap:6px;align-items:center'}, [this.testChoices[i], p[1]]);
            },this))),
            E('div', {style:'display:flex;flex-wrap:wrap;gap:12px;align-items:center'}, [this.testDuration,this.testStart,this.testStop]),
            this.testProgress,
            E('div', {style:'overflow-x:auto'}, E('table', {class:'table warp-test-table'}, [
                E('thead', {}, E('tr', {}, testColumns.map(function(t) {return E('th',{},t);}))),
                this.testRows
            ])),
            E('p', {}, 'Успешные HTTP — ответы 2xx/3xx, включая перенаправления на вход. Ответы 401, 403 и 429 показаны отдельно: возможны вход в аккаунт, антибот, региональный запрет или лимит запросов. Это не подтверждение работы чата или воспроизведения видео.'),
            E('p', {}, 'Небольшие HTTPS-запросы выполняются по очереди, обычно раз в минуту. Тест не скачивает видео и не измеряет предельную скорость. Смена или восстановление туннеля завершает текущую проверку; результат хранится до нового запуска или перезагрузки роутера.')
        ]);
    },
    testAction: function(fn) {
        this.testPending = true; this.testStart.disabled = true; this.testStop.disabled = true;
        return fn().then(L.bind(function(result) {
            if (!result || !result.ok) ui.addNotification(null,E('p',message(result && result.code)),'error');
            if (result && result.code === 'stopping') this.testProgress.textContent = 'Останавливается после текущего запроса, до 8 секунд…';
            return this.refreshTest();
        },this)).catch(function(err) {ui.addNotification(null,E('p',err.message),'error');})
            .finally(L.bind(function() {this.testPending=false; this.refreshTest();},this));
    },
    refreshTest: function() {
        if (!this.testProgress) return Promise.resolve();
        return testStatusRPC().then(L.bind(function(s) {
            const running = s.state === 'running' || s.state === 'stopping';
            const labels = {idle:'Проверка ещё не запускалась',running:'Проверка идёт',stopping:'Останавливается, до 8 секунд',complete:'Проверка завершена',stopped:'Остановлена',interrupted:'Прервана',changed:'Завершена: туннель изменился'};
            const elapsed = running ? Math.max(s.elapsed || 0, Math.floor(Date.now()/1000)-(s.started_at || Date.now()/1000)) : (s.elapsed || 0);
            const duration = Number(s.minutes || 0)*60;
            const time = Math.floor(Math.min(elapsed,duration)/60) + ':' + String(Math.min(elapsed,duration)%60).padStart(2,'0');
            this.testProgress.textContent = (labels[s.state] || 'Не удалось получить состояние') +
                (duration ? ' · ' + time + ' из ' + s.minutes + ' мин · кругов: ' + (s.round || 0) +
                ' · проверок выхода WARP: ' + (s.warp_checks || 0) + ', сбоев: ' + (s.warp_failures || 0) : '');
            this.testStart.disabled = running || !!this.testPending;
            this.testStop.disabled = !running || s.state === 'stopping' || !!this.testPending;
            this.testDuration.disabled = running;
            this.testChoices.forEach(function(c) {c.disabled=running; if(running)c.checked=(','+s.selection+',').includes(','+c.value+',');});
            if (running) this.testDuration.value=String(s.minutes);
            const names = Object.fromEntries(testProfiles.map(function(p) {return [p[0],p[1]];}));
            const last = {ok:'Ответ получен',restricted:'Ограничение / вход',dns:'Ошибка DNS',network:'Ошибка соединения',http:'Ошибка HTTP'};
            const order=testProfiles.map(function(p){return p[0];});
            this.testRows.replaceChildren.apply(this.testRows,(s.services || []).slice().sort(function(a,b){return order.indexOf(a.id)-order.indexOf(b.id);}).map(function(r) {
                const errors = r.dns+r.network+r.http;
                return E('tr',{},[names[r.id] || r.id,r.good+' / '+r.total,String(r.restricted),
                    errors+' (DNS '+r.dns+', связь '+r.network+', HTTP '+r.http+')',
                    r.median_ms+' / '+r.p95_ms+' мс',(last[r.last] || r.last)+(r.http_code && r.http_code !== '000' ? ' · '+r.http_code : '')
                ].map(function(t,i) {return E('td',{'data-label':testColumns[i]},t);}));
            }));
        },this));
    },
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
                ['Состояние', s.busy ? 'Выполняется операция… ' + (s.job_active && s.started_at ? Math.max(0, Math.floor(Date.now()/1000)-Number(s.started_at)) + ' с' : '') : (states[s.state] || 'Неизвестно')],
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
            const tester = this.renderTester();
            const autotune = this.renderAutotune(); autotune.hidden=true;
            tester.hidden = true;
            const switchTab = function(which) {
                root.hidden=which!=='main'; tester.hidden=which!=='test'; autotune.hidden=which!=='auto';
                const saveActions=document.querySelector('.cbi-page-actions');
                if(saveActions) {
                    saveActions.hidden=which!=='main';
                    if(which==='main') saveActions.style.removeProperty('display');
                    else saveActions.style.setProperty('display','none','important');
                }
            };
            const tabs = E('div', {style:'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0'}, [
                E('button',{class:'btn',click:function(){switchTab('main');}},'Подключение'),
                E('button',{class:'btn',click:function(){switchTab('test');}},'Проверка стабильности'),
                E('button',{class:'btn',click:function(){switchTab('auto');}},'Автоподбор')
            ]);
            this.refresh(); poll.add(L.bind(this.refresh, this), 3);
            this.refreshTest(); poll.add(L.bind(this.refreshTest, this), 5);
            this.refreshAuto(); poll.add(L.bind(this.refreshAuto,this),5);
            return E('div',{},[tabs,root,tester,autotune]);
        }, this));
    }
});
