# Архитектура и инварианты

## Слои приложения

```mermaid
flowchart TD
  UI[Client forms / features] --> A[Server Actions / app]
  P[Server pages / app] --> S[Services]
  A --> S
  S --> R[Repositories]
  P --> R
  R --> DB[Prisma / PostgreSQL + SQL constraints]
  A --> W[Local workspace bootstrap]
  P --> W
  W --> DB
```

Страницы — серверные компоненты; интерактивные формы находятся в `src/features/`.
Чтение местами идёт из страницы прямо в repository. Изменения проходят через
Server Actions: Zod-проверка, определение локальной группы, сервис/репозиторий,
преобразование ожидаемых ошибок в типизированный результат, `revalidatePath`.
Атомарные финансовые операции находятся в repositories, чистое распределение —
в `src/server/services/sale-distribution.ts`.

В `next.config.ts` включены `cacheComponents` и `partialPrefetching`.
Динамические части страниц используют `Suspense` и `await io()` из `next/cache`.
API установленной версии Next.js проверяют по `node_modules/next/dist/docs/`.

## Маршруты

| URL | Назначение |
| --- | --- |
| `/` | Переход на `/dashboard` |
| `/dashboard` | Банк, остатки, последние рейды, аналитика |
| `/members` | Участники, деактивация и игровые профили |
| `/compositions` | Именованные составы и builder слотов |
| `/items`, `/items/[id]` | Каталог, поиск, классификация и история поступлений |
| `/raids`, `/raids/new` | Список и создание рейдов |
| `/raids/[id]`, `/raids/[id]/edit` | Добыча, продажи, снимок и разрешённое редактирование |
| `/sales` | Остатки и передачи участникам |
| `/ledger` | Журнал продаж, долей и передач |
| `/settings` | Название группы, сведения о резервировании базы и очистка |
| `/api/ledger/export` | CSV всех операций группы |
| `/api/backups/[name]` | Legacy endpoint; возвращает `410 Gone` для SQLite-архивов |

Отдельных `/members/[id]` и `/sales/[id]` нет. История продажи раскрывается
у добычи рейда и в журнале. Технические проводки не выводятся как бухгалтерский UI.

## Workspace и модель данных

`ensureLocalWorkspace()` в транзакции создаёт/находит `local-user`, одну Party и
OWNER membership. Несколько membership, неверная роль или группа без локального
владельца приводят к ошибке. Это bootstrap локальных данных, не авторизация.
`partyId` определяется сервером; операции группы ограничены группой. `Item` —
общий каталог и намеренно не имеет `partyId`; рейдовый запрос проверяет предмет по
общему идентификатору, а история добычи остаётся scoped к группе.

| Сущность | Назначение |
| --- | --- |
| `PartyMember` | Персонаж с уникальным нормализованным ником и признаком активности |
| `PartyMemberProfile` | Игровые профили персонажа с классом, ролью, уровнем и заметкой |
| `PartyComposition` / `PartyCompositionMember` | Шаблон до 36 слотов «участник + профиль» |
| `Item` | Общая уникальная запись каталога предметов с классификацией; не удаляется при очистке партии |
| `Raid` / `RaidParticipant` | Рейд и исходный снимок всех активных участников со статусами |
| `LootDrop` | Отдельное поступление Item с количеством |
| `SaleTransaction` / `SaleShare` | Полученная оплата и рассчитанные доли |
| `MemberPayment` / `PaymentAllocation` | Реальная передача и покрытие имеющихся долей |
| `LedgerTransaction` / `LedgerEntry` | Внутренний журнал — источник банка и остатков |

Ник, профиль, класс, роль и уровень сохраняются в снимке рейда. Деактивация
участника/профиля не переписывает снимок. При редактировании посещаемости обновляются
исходные строки. Обычного hard-delete исторических сущностей нет; связи используют
RESTRICT. Подтверждённая очистка всей группы — отдельная административная операция
в `party-repository.ts`; транзакция устанавливает локальную настройку `app.party_reset`,
которую PostgreSQL guards проверяют перед временным разрешением удаления. Общий
каталог предметов очистка партии не меняет.

Bootstrap восстанавливает отсутствующие имена из `prisma/seeds/lineage2-high-five-items.json`
(130 названий). Существующие записи не перезаписывает; однократная миграция старой
классификации не заменяет последующие пользовательские правки. Загрузка страницы
может инициировать bootstrap-запись, даже если её основная операция — чтение.

## Финансовые инварианты

1. Хранение и расчёты Adena — целые `bigint`, сериализация — десятичные строки.
   Короткий формат отображения не используется для расчётов.
2. Продажа означает полученную оплату. Суммарное проданное количество не превышает
   количество LootDrop. Каждая частичная продажа распределяется независимо.
3. Только PRESENT из исходного снимка рейда получают равные доли. Largest Remainder
   сохраняет точную сумму, равные остатки разрешаются по `RaidParticipant.id`.
   Доля Party — 0%. Текущий roster не используется вместо снимка.
4. Калькулятор поддерживает weights, но sale repository передаёт расчётный вес `1`.
   `SaleShare.weightSnapshot` хранит исходный `RaidParticipant.distributionWeight`,
   включая старые значения >1: SQL требует совпадения исторических метаданных.
   Нельзя подменять snapshot расчётным весом или включать старые веса в новый расчёт.
5. Продажа, доли, сбалансированные проводки, POSTED и блокировка рейда атомарны.
   После первой продажи посещаемость и финансовые поля добычи заблокированы.
6. Передачи допускают превышение начислений и доступного банка. Отрицательный
   остаток отражает переплату/долг, рекомендация UI не является ограничением.
   Покрытие имеющихся долей — FIFO по времени получения продажи, затем времени
   создания доли и её id. Сумма сверх покрытия отражается в общем остатке.
7. Ключ идемпотентности ограничен группой: тот же ключ/параметры возвращают
   существующий результат; другие параметры с тем же ключом — конфликт.
8. POSTED финансовая история неизменяема. Возвратов, сторно, комиссий и ручных
   корректировок нет. Обычные действия не переписывают старые начисления.
9. Repositories повторяют распознанные PostgreSQL serialization/deadlock failures
   максимум три раза, с задержками 40 и 120 мс.
10. Дополнительные ограничения PostgreSQL реализованы в
    `prisma/postgresql-constraints.sql`: положительные значения, oversell,
    блокировка рейда, баланс и неизменяемость.
    Одной Prisma-схемы недостаточно.

UI-продажа и UI-передача по-разному трактуют число без суффикса. Текущий контракт
и ограничение payment-prefill описаны в [PROJECT_SPEC.md](../PROJECT_SPEC.md#денежный-ввод).
Их изменение требует явного отдельного согласования.

## Время

Дата рейда вводится в зоне браузера → преобразуется в UTC → локально отображается.
Преобразование отклоняет несуществующие и неоднозначные времена рейда при DST.
`DateInput` хранит видимый draft отдельно от нормализованного значения; неверная дата
остаётся в поле, получает связанную ошибку и блокирует submit. Форматы полей:
`ДД.ММ.ГГГГ` и `ДД.ММ.ГГГГ ЧЧ:ММ`.

## Хранение и восстановление

`DATABASE_URL` обязателен; Prisma Client uses `@prisma/adapter-pg` and a PostgreSQL
connection pool. Local development connects to the Docker Compose PostgreSQL
service; production connects to Neon through server-only environment variables.
SQLite legacy data is retained only as the source for the one-time item catalog
import. The importer opens it read-only and transfers no party or financial rows.

Production backup and restore are managed through the selected PostgreSQL provider.
Local dumps use `pg_dump`; do not point PostgreSQL restore procedures at legacy
SQLite archives. Upload storage is not configured yet. Nullable `screenshotPath`
does not mean upload UI exists.

## Ограничения эксплуатации и проверок

- PostgreSQL schema is created by migrations under
  `prisma/migrations-postgresql/`; `db:deploy` also applies repeatable SQL guards.
- SQLite migrations and integration fixtures remain legacy material and do not
  validate the PostgreSQL runtime. PostgreSQL integration tests require a separate
  disposable test database before use as a CI gate.
- Vitest работает в Node; тесты находятся рядом с кодом. Проверяются Zod, services,
  repositories, распределение, даты и CSV. PostgreSQL integration tests требуют
  отдельный `TEST_DATABASE_URL`; SQLite backup tests оставлены как legacy tests.
  Сохраняемого браузерного набора тестов нет.
- Проверки `lint`, `typecheck`, `test`, `build` не заменяют визуальную проверку
  UI, accessibility и реальной конкуренции нескольких клиентов.
