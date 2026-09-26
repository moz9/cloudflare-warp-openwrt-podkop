# Инструкции для агентов

## Открытые замечания ревью

Перед началом работы прочитайте `docs/REVIEW-2026-09-26.md`. Там список
найденных ошибок и предложений с путями к файлам и вариантами исправления.
Исправленные пункты отмечайте в этом файле; когда открытых не останется,
удалите его и этот раздел.

## Проект

- Скрипты в `root/` выполняются на OpenWrt под BusyBox `ash`. Пишите POSIX sh
  без bash-расширений.
- Целевая платформа: `aarch64_cortex-a53`, OpenWrt 24.10 (`opkg`) и 25.12 (`apk`).
- Реального роутера в среде разработки нет. Изменения логики менеджера
  (`warp-manager`, `warp-autotune`, `warp-podkop`, установщик) сопровождайте
  хостовыми тестами в `tests/` и явно отмечайте, что требует проверки на роутере.
- Хостовые проверки:

  ```sh
  python3 tests/test_static.py
  sh tests/test_api.sh
  python3 tests/test_speed.py
  python3 tests/test_quick.py
  python3 tests/test_autotune.py
  python3 tests/test_stability.py
  node --test tests/test_installer.cjs tests/test_setup.cjs tests/test_autotune_view.cjs
  sh tests/test_concurrency.sh "$PWD/root/usr/libexec/warp-common"
  ```

- Документация и интерфейс написаны на русском языке. Файлы хранятся в UTF-8.
