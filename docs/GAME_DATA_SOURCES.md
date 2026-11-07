# Источники игровых данных

## Профессии и иконки

- [L2-SERVERA: дерево профессий](https://l2-servera.com/en/kategorii/wiki/skills/)
  — выбранный пользователем ориентир для названий и связей профессий. Страница
  относится к Interlude; изображения узлов можно сопоставлять по alt класса.
  Примеры: `1skill1410.jpeg` — Cardinal, `1skill1406.jpeg` — Arcana Lord.
- Текущие иконки в приложении — 35 PNG, предоставленных пользователем, в
  `public/game-icons/classes/`. Соответствия 37 классов задаёт
  `src/features/members/class-icon-map.ts`.
  Male/Female Soul Hound используют общий `soul-hound.png`; Inspector — символ
  ветки Judicator. Это сопоставление для UI, не утверждение об отдельных эмблемах.
- [L2Hub: классы C4](https://l2hub.info/c4/classes) — сохранённый справочник и дерево
  классов. C4 не покрывает Kamael и не заменяет каталог High Five приложения.
- Английские подписи персонажа: `Main`, `Subclass 1` … `Subclass 4`.
  Лимит приложения по запросу пользователя — Main + четыре Subclass, пять всего;
  он не выводится из стандартных ограничений конкретных хроник.

## Предметы

- Локальные иконки: `public/game-icons/items/`. Первые шесть изображений взяты из
  `https://l2db.info/uploads/images/icons/`; изображения Lab 78 — из таблицы
  `prompts/дроп.md` (BOHPTS). Названия файлов первых шести: weapon_vesper_cutter_i00, armor_t94_u_i01,
  etc_scroll_of_enchant_weapon_i05, etc_scroll_of_enchant_armor_i05,
  etc_mineral_rare_i03, etc_codex_of_giant_i00. Неизвестные соответствия используют
  нейтральный fallback; открытие формы больше не загружает внешние иконки предметов.
  Табличные изображения локально привязаны только к указанным предметам; неизвестные
  соответствия используют нейтральный fallback. Публичная доступность не устанавливает
  свободную лицензию. Полный каталог иконок не импортируется.
- Favicon приложения использует иконку Adena `etc_adena_i00.png` из той же базы L2DB;
  файл хранится в `src/app/icon.png` и подключается через соглашение Next.js `app/icon`.
- Metadata инстансов — `prisma/seeds/instances.json`. Неподтверждённые уровни
  Labyrinth/Hall of the Abyss помечены SERVER_VARIANT до уточнения retail-соответствия;
  Istina/Frintezza Chaotic и Fortress/Castle Dungeon имеют явную серверную
  маркировку; имя Fortress/Castle Dungeon взято из таблицы BOHPTS.
- Stage 1 рекомендации Lab 78 и Fortress/Castle Dungeon транскрибированы из
  `prompts/дроп.md` и `prompts/Снимок экрана 2026-11-06 222048.png` в
  `prisma/seeds/bohpts-stage-1-loot.json`. Количество и group-chance остаются
  метаданными источника, не отображаются в форме и не задают количество лута.
  Порядок строк сохранён; иные рекомендации и быстрые наборы пока пусты. Приложение
  не вычисляет вероятности.

- [Linedia: All_icons](https://linedia.ru/wiki/All_icons) — сохранённая ссылка для
  изучения иконок и связанных страниц предметов. Это wiki-страница с файлом,
  а не готовый API или нормализованная база каталога.
- Linedia содержит материалы разных хроник; L2Hub по указанной ссылке — C4.
  При расширении High Five-каталога проверять хроники, названия, ID и соответствие
  изображения предмету. Не смешивать C4, Interlude, High Five и Essence автоматически.
- Работающий каталог и история продаж не заменяются данными этих сайтов.
  Массовый импорт требует отдельного сопоставления и устранения дублей.
- Публичная доступность изображения не устанавливает свободную лицензию.
  Страницы не предоставили явной открытой лицензии на весь каталог; ссылки на
  источники не означают разрешения на безусловное переиздание полной базы.

## Названия инстансов

Для названий зон/режимов используются сохранённые тексты patch notes:
[Gracia Final](https://legacy-lineage2.com/news/graciafinal_04.html),
[Kamael](https://legacy-lineage2.com/news/kamael_05.html),
[Gracia Epilogue](https://lineage2wiki.org/gracia-epilogue/patch-notes/),
[Freya](https://lineage2wiki.org/freya/patch-notes/) и
[High Five](https://lineage2wiki.org/hi-five/patch-notes/).
Это справочники названий, а не источник автоматически назначаемого дропа.
Istina относится к более позднему GoD-контенту и в каталоге H5 помечается
серверным вариантом, как и Frintezza Chaotic. Для неподтверждённой retail-матрицы
уровней Labyrinth/Hall of the Abyss также используется SERVER_VARIANT.
