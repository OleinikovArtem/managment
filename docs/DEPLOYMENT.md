# Размещение и данные

## Среды

Локальная разработка использует Next.js и PostgreSQL в Docker Compose. Именованный
volume `party-bank-postgres-data` сохраняет базу между перезапусками контейнера.
`npm run db:down` останавливает PostgreSQL и сохраняет volume; `docker compose down -v`
удаляет его и все локальные записи.

Production — Next.js на Vercel и PostgreSQL на Neon:

- Приложение: https://party-bank-manager.vercel.app.
- Vercel: `artemoleinikovwebs-projects/party-bank-manager`, Node.js 22,
  Next.js framework preset, команда сборки `npm run build`.
- Neon: `party-bank-manager-db`, регион Frankfurt (`aws-eu-central-1`), Free.
  База подключена интеграцией Vercel только к production; функции приложения
  выполняются в `fra1`.
- Репозиторий: `OleinikovArtem/managment`; production-ветка `master`.
  Автоматические Git-деплои включены.
- `.vercelignore` исключает локальные env-файлы, базы, backup, generated Prisma
  и вспомогательные артефакты из загрузки исходников через CLI.

GitHub Pages не запускает это серверное приложение. Vercel и Neon имеют отдельные
тарифы и квоты; действующие условия проверяют у провайдеров.

| Запуск | Переменные | База |
| --- | --- | --- |
| `npm run dev` | Локальные `.env` / `.env.local` | Docker PostgreSQL |
| `npm run build`, затем `npm start` | Приватный `.env.production.local` имеет приоритет над `.env.local` / `.env` | Живая production-БД Neon |
| Vercel Production | Серверные переменные Production в Vercel | Production-БД Neon |
| Vercel Preview | Требуют отдельной настройки | Отдельная БД пока не подключена |

Не задавайте production-подключение в общих `.env.local` или Development-переменных:
Next.js читает `.env.local` и при разработке. Окружение процесса имеет приоритет
над файлами. Приведённые локальные подключения предполагают, что переменные БД
не переопределены в окружении процесса.

## Git и деплой

Push в `master` запускает production-сборку Vercel. `scripts/build.cjs` при
`VERCEL_ENV=production` применяет миграции, financial/catalog SQL guards и
административный seed отсутствующих базовых предметов и metadata инстансов,
генерирует Prisma Client
и собирает Next.js. `lint`, `typecheck` и `test` не добавлены отдельными шагами
этого скрипта; запускайте их до push. Успешная сборка не заменяет проверку входа
и работы с данными на опубликованном адресе.

Другие ветки могут запускать Preview-деплои, но отдельные Preview-БД и секреты
пока не настроены. Production-подключение намеренно не выдаётся этой среде;
Preview не считается рабочим окружением до её отдельной настройки.

При загрузке исходников через CLI каталог должен быть связан именно с
`artemoleinikovwebs-projects/party-bank-manager`; проверьте `vercel project inspect`
до деплоя. `.vercel/project.json` — локальная связь, в Git не хранится. Для
автодеплоя из GitHub она не нужна. `.vercelignore` применяется к CLI-загрузке;
приватные env-файлы, базы и generated Prisma также исключены через `.gitignore`.

## PostgreSQL и миграции

- `DATABASE_URL` — connection string приложения. Для Neon используйте pooled URL.
- `DIRECT_URL` — direct connection для Prisma CLI и миграций. Локально оба значения
  указывают на Docker PostgreSQL.
- `npm run db:deploy` применяет миграции `prisma/migrations-postgresql/` и SQL
  ограничения из `prisma/postgresql-constraints.sql`.
- Production build (`VERCEL_ENV=production`) запускает `prisma migrate deploy`,
  применяет SQL guards, генерирует Prisma Client и собирает Next.js.
- Не используйте `db:push` для обновления базы. Не запускайте миграции на рабочей
  базе без проверенной резервной копии и сверки ожидаемой схемы.
- Все финансовые и пользовательские данные хранятся в PostgreSQL. Файловая система
  Vercel Function не является постоянным хранилищем.

Локальный `.env` используется для разработки с Docker. Не коммитьте env-файлы
или значения секретов.

## Локальная production-сборка с production-БД

Приватный `.env.production.local` в корне проекта содержит production
`DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `PARTY_TOKEN_ENCRYPTION_KEY`.
`BETTER_AUTH_URL` в нём равен `http://localhost:3000`, чтобы локальная авторизация
работала на локальном адресе. Файл исключён из Git и загрузки через Vercel CLI.
Он не появляется после `git clone`: восстановите пять обязательных значений из
защищённого хранилища секретов. `.env.example` — шаблон локальной разработки,
а не копия production-настроек. Значения секретов не добавляют в документацию.

```powershell
npm run build
npm start
```

Откройте http://localhost:3000. Next.js загружает `.env.production.local` для
production-сборки и `next start`; этот файл имеет приоритет над `.env.local` и
`.env`. `npm run dev` его не использует и продолжает работать с локальным Docker.
Переменные, уже заданные в окружении процесса, имеют приоритет над env-файлами.

Локальная production-версия работает с живой production-БД: создание, изменение
и удаление данных сразу видны в размещённом приложении. Отдельного тестового
окружения этот файл не создаёт. Не добавляйте в него `VERCEL_ENV=production`:
применение миграций при локальной сборке не требуется. Prisma CLI и обычные
Node-скрипты сами этот файл не загружают; их `dotenv/config` продолжает читать
`.env`.

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | Пул соединений приложения к PostgreSQL |
| `DIRECT_URL` | Прямое соединение Prisma CLI с PostgreSQL |
| `BETTER_AUTH_URL` | Базовый URL приложения для auth |
| `BETTER_AUTH_SECRET` | Секрет сессий Better Auth; production secret должен быть случайным и не короче 32 символов |
| `PARTY_TOKEN_ENCRYPTION_KEY` | Серверный ключ AES-256-GCM, 32 байта в hex, для Telegram-токенов |
| `LEGACY_SQLITE_URL` | Необязательный путь к старой SQLite-базе только для импорта каталога |
| `TELEGRAM_WEBHOOK_BASE_URL` | Необязательный публичный HTTPS-origin для Telegram; без него используется `BETTER_AUTH_URL` |

Сохраните `PARTY_TOKEN_ENCRYPTION_KEY` отдельно от базы и не меняйте без плана
перешифрования: без прежнего ключа сохранённые Telegram-токены не расшифровать.
Секреты доступны только серверному runtime и не передаются клиенту.
В Vercel `BETTER_AUTH_URL` равен `https://party-bank-manager.vercel.app`.
Интеграция Neon задаёт pooled `DATABASE_URL` и direct `DATABASE_URL_UNPOOLED`;
для используемой конфигурации Prisma direct-значение также сохранено как
`DIRECT_URL`. Не копируйте автоматически весь экспорт переменных Vercel в
локальный production-env: служебный `VERCEL_ENV=production` включил бы миграции
при локальной сборке.

## Перенос общего каталога

Старая SQLite-база не является рабочей базой и не импортируется целиком. При наличии
`prisma/dev.db` можно проверить и импортировать только строки общего каталога:

```powershell
npm run db:catalog:check
npm run db:catalog:import
```

Импортёр открывает SQLite read-only и переносит записи `Item`; он не переносит
учётные записи, партии, участников, профили или финансовые операции. PostgreSQL
становится источником актуального каталога. Новые изменения каталога не
синхронизируются обратно в SQLite.

## Резервирование и восстановление

- Для production используйте историю/backup и процедуру восстановления Neon.
  Проверьте срок хранения и доступность восстановления в настройках проекта;
  отдельного задания резервирования в репозитории нет.
- Для локальной базы создавайте dump PostgreSQL, например:

  ```powershell
  docker compose exec -T postgres pg_dump -U party_bank -d party_bank -f /tmp/party-bank.sql
  docker compose cp postgres:/tmp/party-bank.sql ./party-bank.sql
  ```

  Файл создаётся внутри контейнера и копируется без shell-перекодирования;
  это сохраняет UTF-8, в том числе в Windows PowerShell 5.1.

- Перед восстановлением сохраните текущую базу отдельно и используйте процедуру
  выбранного PostgreSQL-провайдера.
- ZIP-архивы и SQLite backup старой версии не являются резервной копией PostgreSQL.
- Очистка группы — бизнес-операция владельца, не средство восстановления. Она
  сохраняет общий каталог предметов, аккаунты, членства и настройки группы.

## Ограничения запуска

Авторизация по логину и паролю работает без email. Новые пароли — 8–128 символов,
буква и цифра. Самостоятельного сброса пароля нет; определите и протестируйте
процесс восстановления до публичной регистрации.
Telegram использует публичный HTTPS webhook и зашифрованный токен отдельного бота
каждой группы. После применения новой миграции владелец должен открыть настройки
Telegram и подключить webhook; прежнее сохранение токена само по себе его не
регистрирует. Приём не зависит от открытого браузера. Локально используйте отдельный
тестовый receiving bot, изолированную БД и HTTPS-туннель через
`TELEGRAM_WEBHOOK_BASE_URL`. Не перенастраивайте production-бота на локальную копию.
Для PostgreSQL integration tests используйте только заранее настроенную локальную
тестовую БД через `TEST_DATABASE_URL`; не создавайте дополнительные БД и не
запускайте тесты на production-БД. Не создавайте копии/клоны checkout для тестов.
