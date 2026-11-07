# Карта проекта

Party Bank Manager — русскоязычное приложение для учёта нескольких групп Lineage 2.
Участники → состав рейда → добыча → полученная оплата → доли → передачи Adena.
Продуктовые правила: [PROJECT_SPEC.md](../PROJECT_SPEC.md).
Запуск и восстановление: [README.md](../README.md).

## Навигация и исходники

| Задача                                                          | Основные файлы                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Маршруты, загрузка, Server Actions                              | `src/app/(dashboard)/`                                                                                                                                                                          |
| Shell и связь разделов                                          | `src/components/layout/sidebar.tsx`, `section-navigation.tsx`                                                                                                                                   |
| Общий стиль и UI                                                | `src/app/globals.css`, `src/components/ui/`                                                                                                                                                     |
| Обзор и аналитика                                               | `src/features/dashboard/dashboard-analytics.tsx`                                                                                                                                                |
| Участники и профили                                             | `src/features/members/`                                                                                                                                                                         |
| Main/Subclass и локальные иконки профессий                      | `member-schema.ts`, `member-subclass-repository.ts`, `public/game-icons/classes/`; источники: [GAME_DATA_SOURCES.md](./GAME_DATA_SOURCES.md)                                                    |
| Сохранённые составы                                             | `src/features/compositions/`                                                                                                                                                                    |
| Каталог, поиск, редактирование                                  | `src/features/items/`                                                                                                                                                                           |
| Весь лут, фильтры, остатки и модальная ручная продажа           | `src/features/loot/`, `src/server/repositories/loot-repository.ts`, `src/app/(dashboard)/loot/`                                                                                                 |
| Создание и редактирование рейда                                 | `src/features/raids/raid-form.tsx`, `loot-picker.tsx`, `instance-picker.tsx`, `profile-picker.tsx`                                                                                              |
| Список рейдов, локальные периоды и фильтры                       | `src/features/raids/raid-list.tsx`, `raid-list-model.ts`, `/raids`                                                                                                                             |
| Инстансы, стадии, настройки рекомендаций                        | `src/features/instances/`, `instance-repository.ts`, `raids/catalog-actions.ts`; [INSTANCE_CATALOG.md](./INSTANCE_CATALOG.md)                                                                   |
| Detail рейда, только просмотр добычи/времени и состав PRESENT   | `raid-detail-view.tsx`, `raid-detail-view.css` в `src/features/raids/`; продажи вручную — `src/features/loot/`, автоматически — Telegram flow                                                   |
| Передачи и получатели                                           | `src/features/sales/payment-form.tsx`, `payout-list.tsx`, `src/components/ui/side-panel.tsx`                                                                                                    |
| Продажа и валидация финансов                                    | `src/features/sales/sale-form.tsx`, `sale-schema.ts`, `payment-schema.ts`                                                                                                                       |
| Журнал                                                          | `src/features/ledger/history-list.tsx`                                                                                                                                                          |
| Настройки и выборочный сброс группы                             | `src/features/settings/reset-plan.ts`, `reset-data-card.tsx`, `src/server/repositories/party-repository.ts`                                                                                     |
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

Команды: `npm run format` (Prettier для исходников и скриптов), `npm run format:check`,
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Тесты лежат рядом с исходниками, среда Vitest — Node. PostgreSQL integration tests
используют только явно заданный `TEST_DATABASE_URL`; без него они пропускаются.
Автоматического браузерного набора в репозитории нет.

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
