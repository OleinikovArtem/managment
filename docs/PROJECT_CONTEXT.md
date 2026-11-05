# Карта проекта

Party Bank Manager — локальный русский интерфейс для группы Lineage 2.
Участники → состав рейда → добыча → полученная оплата → доли → передачи Adena.
Продуктовые правила: [PROJECT_SPEC.md](../PROJECT_SPEC.md).
Запуск и восстановление: [README.md](../README.md).

## Навигация и исходники

| Задача | Основные файлы |
| --- | --- |
| Маршруты, загрузка, Server Actions | `src/app/(dashboard)/` |
| Shell и связь разделов | `src/components/layout/sidebar.tsx`, `section-navigation.tsx` |
| Общий стиль и UI | `src/app/globals.css`, `src/components/ui/` |
| Обзор и аналитика | `src/features/dashboard/dashboard-analytics.tsx` |
| Участники и профили | `src/features/members/` |
| Сохранённые составы | `src/features/compositions/` |
| Каталог, поиск, редактирование | `src/features/items/` |
| Создание и редактирование рейда | `src/features/raids/raid-form.tsx`, `item-combobox.tsx` |
| Detail рейда, история и продажа | `raid-detail-view.tsx`, `raid-detail-view.css`, `raid-sale-workspace.tsx` в `src/features/raids/` |
| Передачи и получатели | `src/features/sales/payment-form.tsx`, `payout-list.tsx` |
| Продажа и валидация финансов | `src/features/sales/sale-form.tsx`, `sale-schema.ts`, `payment-schema.ts` |
| Журнал | `src/features/ledger/history-list.tsx` |
| Настройки и резервные копии | `src/features/settings/`, `src/server/services/backup-service.ts` |
| Правила и транзакции | `src/server/services/`, `src/server/repositories/` |
| Локальная группа и базовый каталог | `src/server/bootstrap/`, `prisma/seeds/lineage2-high-five-items.json` |
| Схема и финансовые защиты | `prisma/schema.prisma`, `prisma/financial-constraints.sql` |
| Клиент БД | `src/lib/db/prisma.ts` |
| Parser и короткие суммы | `src/lib/adena.ts`, `src/components/ui/adena-amount.tsx` |
| CSV | `src/server/services/financial-history-csv.ts`, `src/app/api/ledger/export/route.ts` |

## Технические ориентиры

- Next.js App Router, React, TypeScript strict, Tailwind 4, shadcn/Base UI,
  React Hook Form + Zod, Prisma + better-sqlite3, Vitest. Версии — в lockfile.
- Алиас `@/` ведёт в `src/`. Сгенерированный Prisma client — `src/generated/prisma/`;
  его не редактируют и не добавляют в Git.
- Динамические части страниц используют `Suspense` и `await io()`. Перед изменением
  Next.js API читать документацию установленной версии в `node_modules/next/dist/docs/`.
- Денежные правила, snapshot weights, идемпотентность и защита истории описаны
  в [ARCHITECTURE.md](./ARCHITECTURE.md). Не выводить их из UI или старых данных.
- Формы продажи и передачи имеют разный смысл числа без суффикса; не унифицировать
  его попутно с правками интерфейса. Контракт — в спецификации продукта.
- UI-правила и адаптивность: [UI_RULES.md](./UI_RULES.md).

## Проверки и данные

Команды: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Тесты лежат рядом с исходниками, среда Vitest — Node. Финансовые и backup integration
тесты создают копии текущей `prisma/dev.db`; на чистом checkout нужна актуальная
тестовая схема. Автоматического браузерного набора в репозитории нет.

Рабочую базу не сбрасывают для расследований. `db:sync` предназначен для disposable
базы, а не миграции ценных данных. БД, uploads, backups и кандидаты восстановления
не являются временными файлами для уборки. `scripts/seed-demo-data.cjs` — используемый
npm-инструмент записи demo-данных, не production bootstrap.
