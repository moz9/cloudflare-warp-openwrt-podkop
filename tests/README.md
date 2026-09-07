# Проверки

Для поддерживаемого opkg-выпуска:

```sh
python tests/test_ipk.py
python tests/test_stability.py
sh tests/test_concurrency.sh "$PWD/root/usr/libexec/warp-common"
sh tests/test_scout_route.sh "$PWD/root/usr/libexec/warp-common"
```

На OpenWrt, после установки, без сетевых запросов или изменений конфигурации:

```sh
sh tests/test_stability.sh /usr/libexec/warp-test /usr/share/warp-test /usr/libexec/warp-common
ucode tests/test_rpc.uc /usr/share/rpcd/ucode/warp.uc
```

Первый сценарий использует отдельный каталог и блокировку в `/tmp`, подменённые
часы и ответы сети: проверяет 15/30/45/60 минут, остановку, смену туннеля,
отклонение FakeIP/локальных адресов, неверные наборы сервисов, HTTP-ограничения
и процентили. Второй проверяет реальные замыкания ucode и валидацию RPC;
валидный запуск/остановку теста он не вызывает. Короткий живой тест и полный
15-минутный прогон выполняются отдельно через LuCI.

Следующие унаследованные SDK-сценарии относятся к исходному APK-проекту.

`./tests/run.sh` выполняется на машине сборки. Он проверяет shell, JSON, PO,
ACL/RPC allowlist, отсутствие автоматических маршрутов и firewall-правил,
транзакционный откат, AWG UAPI-контроллер и зафиксированные upstream-исходники.

`tests/router-integration.sh` предназначен для одноразового тестового роутера с
OpenWrt 25.12. Он выполняет реальную регистрацию и поэтому требует явного
`WARP_ACCEPT_CLOUDFLARE_TERMS=YES`. Скрипт сравнивает IPv4/IPv6-маршруты,
`firewall`, `dhcp` и resolv-файл до/после, проверяет userspace AWG TUN,
реальный `warp=on`, права файлов, конфликт имён, отключение, переподключение,
удаление и отсутствие секретов в ubus/logread.

Проверка перезагрузки выполняется двумя фазами:

```sh
WARP_ACCEPT_CLOUDFLARE_TERMS=YES ./router-integration.sh pre-reboot
reboot
WARP_ACCEPT_CLOUDFLARE_TERMS=YES ./router-integration.sh post-reboot
```

Сценарии отсутствия WAN следует выполнять только на изолированном стенде.
