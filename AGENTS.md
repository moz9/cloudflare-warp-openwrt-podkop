# Инструкции для агентов

## Ревью

Решения по предложениям Claude записаны в `docs/REVIEW-2026-09-26.md`.
Файл сохраняется как история решений по запросу владельца проекта.

## Проект

- Скрипты в `root/` выполняются на OpenWrt под BusyBox `ash`. Пишите POSIX sh
  без bash-расширений.
- Целевая платформа: `aarch64_cortex-a53`, OpenWrt 24.10 (`opkg`) и 25.12 (`apk`).
- Изменения логики менеджера (`warp-manager`, `warp-autotune`, `warp-podkop`,
  установщик) сопровождайте хостовыми тестами в `tests/` и отдельно отмечайте,
  что требует проверки на роутере.
- Хостовые проверки:

  ```sh
  python3 tests/test_static.py
  sh tests/test_api.sh
  python3 tests/test_speed.py
  python3 tests/test_quick.py
  python3 tests/test_autotune.py
  python3 tests/test_stability.py
  python3 tests/test_review.py
  node --test tests/test_installer.cjs tests/test_setup.cjs tests/test_autotune_view.cjs
  sh tests/test_concurrency.sh "$PWD/root/usr/libexec/warp-common"
  sh tests/test_scout_route.sh "$PWD/root/usr/libexec/warp-common"
  ```

- Документация и интерфейс написаны на русском языке. Файлы хранятся в UTF-8.
