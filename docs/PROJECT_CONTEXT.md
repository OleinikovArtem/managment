# Карта проекта

Party Bank Manager — русскоязычное приложение для учёта нескольких групп Lineage 2.
Участники → состав рейда → добыча → полученная оплата → доли → передачи Adena.
Продуктовые правила: [PROJECT_SPEC.md](../PROJECT_SPEC.md).
Запуск и восстановление: [README.md](../README.md).
Раздел `/raids` объединяет календарь группы и список рейдов; старый `/calendar`
перенаправляет в режим календаря. Справочные откаты вычисляются без записи в БД.
Подробности дня открываются в боковой панели, запись похода доступна только для
сегодняшней и прошедших дат.
Следующие фичи и границы развития: [scope и этапы](./roadmap/README.md).

## Навигация и исходники

| Задача                                                          | Основные файлы                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Маршруты, загрузка, Server Actions                              | `src/app/(dashboard)/`                                                                                                                                                                          |
| Shell и связь разделов                                          | `src/components/layout/sidebar.tsx`, `section-navigation.tsx`                                                                                                                                   |
| Общий стиль и UI                                                | `src/app/globals.css`, `src/components/ui/`                                                                                                                                                     |
| Единый раздел походов: календарь, список и справочные откаты   | `/raids`, `src/features/calendar/`, `src/features/raids/raid-list.tsx`, `/calendar` redirect, `month-calendar-repository.ts`, `month-calendar-service.ts` |
| Обзор и аналитика                                               | `src/features/dashboard/dashboard-analytics.tsx`                                                                                                                                                |
| Участники и профили                                             | `src/features/members/`                                                                                                                                                                         |
| Main/Subclass, выбор профессии состава и локальные иконки       | `member-schema.ts`, `member-subclass-repository.ts`, `profession-options.ts`, `profession-select.tsx`, `public/game-icons/classes/`; источники: [GAME_DATA_SOURCES.md](./GAME_DATA_SOURCES.md)  |
| Сохранённые составы                                             | `src/features/compositions/`                                                                                                                                                                    |
| Каталог, поиск, редактирование                                  | `src/features/items/`                                                                                                                                                                           |
| Весь лут, фильтры, остатки и модальная ручная продажа           | `src/features/loot/`, `src/server/repositories/loot-repository.ts`, `src/app/(dashboard)/loot/`                                                                                                 |
| Создание и редактирование рейда                                 | `src/features/raids/raid-form.tsx`, `loot-picker.tsx`, `instance-picker.tsx`, `src/features/members/profession-select.tsx`                                                                      |
| Список рейдов, локальные периоды и фильтры                      | `src/features/raids/raid-list.tsx`, `raid-list-model.ts`, `/raids`                                                                                                                              |
| Инстансы, стадии, настройки рекомендаций                        | `src/features/instances/`, `instance-repository.ts`, `raids/catalog-actions.ts`; [INSTANCE_CATALOG.md](./INSTANCE_CATALOG.md)                                                                   |
| Detail рейда, только просмотр добычи/времени и состав PRESENT   | `raid-detail-view.tsx`, `raid-detail-view.css` в `src/features/raids/`; продажи вручную — `src/features/loot/`, автоматически — Telegram flow                                                   |
| Передачи и получатели                                           | `src/features/sales/payment-form.tsx`, `payout-list.tsx`, `src/components/ui/side-panel.tsx`                                                                                                    |
| Продажа и валидация финансов                                    | `src/features/sales/sale-form.tsx`, `sale-schema.ts`, `payment-schema.ts`                                                                                                                       |
| Журнал                                                          | `src/features/ledger/history-list.tsx`                                                                                                                                                          |
| Настройки и выборочный сброс группы                             | `/settings?tab=…`, `src/features/settings/settings-tabs.tsx`, `reset-data-card.tsx`, `reset-plan.ts`, `src/server/repositories/party-repository.ts`; preview считает read-only объёмы сброса    |
| Правила и транзакции                                            | `src/server/services/`, `src/server/repositories/`                                                                                                                                              |
| Общие и собственные каталоги                                    | `item-repository.ts`, `catalog-scope.ts`; административный bootstrap в `src/server/bootstrap/`, metadata seed `scripts/seed-instance-catalog.cjs`                                               |
| Авторизация, роли, приглашения, активность и Telegram-токен     | `src/lib/auth.ts`, `src/server/auth/`, `src/server/services/account-party-service.ts`, `src/server/services/telegram-credential-service.ts`, `src/app/(auth)/`, `src/app/(dashboard)/settings/` |
| Схема и PostgreSQL-защиты                                       | `prisma/schema.prisma`, `prisma/postgresql-constraints.sql`, `prisma/catalog-constraints.sql`                                                                                                   |
| Клиент БД                                                       | `src/lib/db/prisma.ts`                                                                                                                                                                          |
| Parser и короткие суммы                                         | `src/lib/adena.ts`, `src/components/ui/adena-amount.tsx`                                                                                                                                        |
| CSV                                                             | `src/server/services/financial-history-csv.ts`, `src/app/api/ledger/export/route.ts`                                                                                                            |
| Приём Telegram, parser, FIFO-распределение, подключения и inbox | `src/server/telegram/`, `src/app/api/telegram/`, `src/features/telegram/`, `src/app/(dashboard)/telegram/`                                                                                      |
| Правило нового пароля (8–128, буква и цифра)                    | `src/lib/password-policy.ts`, `src/lib/auth.ts`, `src/features/auth/auth-form.tsx`                                                                                                              |

## Технические ориентиры

- Next.js App Router, React, TypeScript strict, Tailwind 4, shadcn/Base UI,
  React Hook Form + Zod, Prisma 7 + PostgreSQL (`pg` driver adapter), Vitest.
  Разработка использует Docker PostgreSQL, production — Vercel и Neon PostgreSQL.
- Алиас `@/` ведёт в `src/`. Сгенерированный Prisma client — `src/generated/prisma/`;
  его не редактируют и не добавляют в Git.
- Динамические части страниц используют `Suspense` и `await io()`. Перед изменением
  Next.js API читать документацию установленной версии в `node_modules/next/dist/docs/`.
- Общая оболочка и постоянные заголовки рейдов/финансов отображаются отдельно от
  запросов к БД; ожидаемые данные занимают структурированные скелетоны.
- `npm run dev` использует локальный `.env`. Приватный `.env.production.local`
  подключает `npm run build` / `npm start` к живой production-БД; Prisma CLI
  автоматически этот файл не читает. Подробности — в [DEPLOYMENT.md](./DEPLOYMENT.md).
- Денежные правила, snapshot weights, идемпотентность и защита истории описаны
  в [ARCHITECTURE.md](./ARCHITECTURE.md). Не выводить их из UI или старых данных.
- Формы продажи и передачи имеют разный смысл числа без суффикса; не унифицировать
  его попутно с правками интерфейса. Контракт — в спецификации продукта.
- UI-правила и адаптивность: [UI_RULES.md](./UI_RULES.md).

## Проверки и данные

Новые пользовательские фичи и изменения существующих сценариев сопровождаются
E2E-тестами в том же изменении. Проверяются результат пользователя, сохранение
данных и релевантные ошибки/права доступа; перед коммитом фичи запускается полный
набор Chromium. Полное правило: [E2E coverage в AGENTS.md](../AGENTS.md#e2e-coverage).

Локальная Docker БД содержит тестовые данные приложения; сохранять необходимо
каталог предметов. Для browser E2E разрешены записи финансов и создание данных
в существующей локальной БД под существующим аккаунтом. Отдельная БД или среда
для них не требуется. Финансовые E2E создают группы с префиксом `e2e-`, участников,
рейды и добычу из существующего общего каталога; группы остаются для просмотра.
Каталог при подготовке и завершении тестов не удаляется и не перезаписывается.
`e2e/financial.spec.ts` проверяет продажи и выплаты через UI и сверяет доли,
остатки и проводки в БД. Повторы отправляют перехваченный реальный Server Action
запрос с прежним ключом; изменённые параметры должны конфликтовать. Конкуренция
проверяется двумя вкладками, чьи запросы продажи последнего остатка одновременно
пропускаются к серверу. Исторические снимки, доли и выплаты сохраняются после
изменения ника, Main/Subclass, состава и деактивации; поздняя продажа использует
исходный roster и исторические веса как метаданные при равном распределении.
Перехваченные запросы и cookies остаются в памяти, trace — в `test-results/`.
P2 покрытие находится в `account-settings.spec.ts`, `ledger-details.spec.ts`,
`mobile-keyboard.spec.ts`, `network-recovery.spec.ts` в `e2e/`. Проверяются выход,
профиль (с восстановлением имени общего аккаунта), переименование группы и аудит,
фильтры/пагинация журнала и содержимое скачанного CSV. CSV сверяется с БД, включая
точные BigInt суммы, экранирование и экспорт независимо от фильтра интерфейса.
Мобильные потоки рейд → продажа → передача проходят на ширинах 390/320 px;
клавиатурные сценарии проверяют выбор профессии, удержание и возврат фокуса.
Сетевые тесты прерывают запрос до записи и теряют ответ после фактического commit,
затем проверяют сохранение черновика/ключа и отсутствие дубликатов при повторе.
По выбранному охвату используется Chromium; дополнительные браузеры не требуются.
P1 browser coverage находится в `e2e/access.spec.ts`, `catalog.spec.ts`,
`compositions.spec.ts`, `reset.spec.ts`, `telegram.spec.ts`. Общая fixture
`local-fixtures.ts` создаёт отдельную группу в той же локальной БД, использует
существующий общий предмет и двух участников. Вход выполняется прежним E2E
аккаунтом; второй уже существующий аккаунт используется только как запись для
проверки членства/ролей и приглашений, без регистрации или отдельной сессии.
Для Stage-проверок требуются две доступные опубликованные стадии и существующие
рекомендации первой стадии; тесты не изменяют глобальные публикации.
Проверяются составы с Main/Subclass/override и применение к рейду, приглашения,
серверные ограничения ролей, переключение групп, свой каталог, архив/восстановление,
свои инстансы, пресеты и конфликт версии Stage. Все шесть категорий reset проверяются
через UI с сохранением каталогов, доступов, Telegram-настроек и чужой группы.
Telegram-тесты отправляют синтетические сообщения в настоящий локальный webhook
и проверяют импорт, идемпотентность, атомарность, уведомления, aliases и ручной разбор.
Тестовая конфигурация бота не содержит реальных credentials; подключения к внешнему
Telegram API/доставки сообщений в Telegram эти тесты не выполняют.
`e2e/members.spec.ts` создаёт группы через UI и проверяет создание/редактирование
участников, Main/Subclass, уникальность ника и деактивацию. Эти группы также
остаются в локальной БД; регистрация новых аккаунтов не требуется.
`e2e/raids.spec.ts` создаёт и редактирует рейды через UI, проверяет посещаемость,
добычу из общего каталога, преобразование даты Europe/Kyiv в UTC, сохранность
Stage и отказ создания с пустой посещаемостью или неверной датой. Подготовка
добавляет участников в новую локальную группу; сам рейд создаётся только через UI.
`e2e/raids-calendar.spec.ts` проверяет объединённые режимы, сохранение состояния,
предзаполнение записи и запрет будущей даты; `e2e/calendar.spec.ts` покрывает сетку,
панель дня, возврат к выбранному дню, откаты и изоляцию групп.

Команды: `npm run format` (Prettier для исходников и скриптов), `npm run format:check`,
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Тесты лежат рядом с исходниками, среда Vitest — Node. PostgreSQL integration tests
используют только явно заданный `TEST_DATABASE_URL`; без него они пропускаются.
Браузерные E2E-тесты лежат в `e2e/` и запускаются через `npm run test:e2e`
с явно заданным `E2E_DATABASE_URL` либо `TEST_DATABASE_URL` на локальный PostgreSQL.
Playwright передаёт этот URL приложению как `DATABASE_URL` и запускает собственный
сервер на порту 3100 без переиспользования существующего. Auth-тест входит под
существующим аккаунтом через `E2E_USERNAME` / `E2E_PASSWORD` из локального `.env`;
регистрации и удаления аккаунта нет. Текущий login-сценарий не меняет данные группы.
`e2e/workspace.spec.ts` проверяет разделы, фильтры рейдов/лута и CSV без изменения
данных группы. Общая fixture входит один раз на worker, выбирает первую доступную
группу и передаёт сессию в изолированные контексты тестов в памяти. Запуск использует
один worker, чтобы не исчерпать лимит входов общего аккаунта. `E2E_PORT` меняет порт
сервера (по умолчанию 3100). Их локальный webServer использует текущий checkout.
Для повторной проверки на уже запущенном E2E сервере того же checkout, порта и
локальной БД можно явно задать `E2E_REUSE_SERVER=1`. По умолчанию повторное
использование сервера отключено.
Создавать копии, клоны или дополнительные рабочие деревья проекта для тестов нельзя. Playwright-отчёты
и результаты остаются в игнорируемых `playwright-report/` и `test-results/`.

Для Vitest PostgreSQL integration tests используй единственную заранее настроенную локальную тестовую
БД через `TEST_DATABASE_URL`. Не создавай новые тестовые базы автоматически и не
подменяй переменную на рабочую/production-БД. Перед запуском проверь, куда указывает
URL; миграции запускай только по явной задаче и только для выбранной среды.

Локальная PostgreSQL база хранится в именованном Docker volume. PostgreSQL migrations
live in `prisma/migrations-postgresql/`; SQLite migrations in `prisma/migrations/`
are retained as legacy history. `scripts/import-item-catalog.cjs` reads the legacy
SQLite database in read-only mode and imports only the shared item catalog. It does
not import party records or financial history.

## Интеграции и ограничения

- Аккаунты, группы, роли, приглашения и ограничения восстановления:
  [требования к многопользовательскому доступу](./ACCOUNTS_AND_PARTIES_SPEC.md).
- Telegram webhook, автоматический импорт продаж, история, уведомления и ручной
  разбор исключений реализованы; для подключения нужен receiving bot владельца.
  Основной приём — пересылка оригинальной продажи BOHPTS в личку receiving bot;
  владелец выбирает личный чат и исходного бота. Поддержан реальный английский формат:
  [правила приёма, разбора и распределения](./TELEGRAM_SALES_INGESTION.md).
- Production размещён на Vercel с БД Neon; настройки и требования к средам:
  [Vercel, PostgreSQL и перенос данных](./DEPLOYMENT.md).
  Репозиторий `OleinikovArtem/managment`, автодеплой из `master`.
  Production-БД не подключена к Preview; для него нужна отдельная среда.
