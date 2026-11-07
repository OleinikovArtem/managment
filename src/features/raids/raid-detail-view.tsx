import Link from "next/link";
import { ArrowLeft, ChevronDown, LockKeyhole, Pencil, Plus } from "lucide-react";
import type { getRaid } from "@/server/services/raid-service";
import { GameIcon } from "@/components/ui/game-icon";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import "./raid-detail-view.css";

type Raid = Awaited<ReturnType<typeof getRaid>>;

/** Raid presentation; all financial data and mutations use the existing contracts. */
export function RaidDetailView({
  raid,
  partyName,
  canManage,
}: {
  raid: Raid;
  partyName: string;
  canManage: boolean;
}) {
  const presentParticipants = raid.participants.filter(({ status }) => status === "PRESENT");
  // Presentation guard only: legacy records can have sales without lockedAt.
  const hasFinancialHistory =
    Boolean(raid.lockedAt) || raid.lootDrops.some((drop) => drop.saleTransactions.length > 0);
  const canEditLoot = canManage && !hasFinancialHistory;

  return (
    <article className="raidDetail-workspace" data-raid-detail>
      <div className="raidDetail-breadcrumb">
        <Link href="/raids">
          <ArrowLeft size={15} aria-hidden="true" />
          Рейды
        </Link>
        <span aria-hidden="true">/</span>
        <span>{partyName}</span>
      </div>

      <header className="raidDetail-header">
        <div className="raidDetail-identity">
          <h1>{raid.name}</h1>
          <div className="raidDetail-metadata">
            <LocalDateTimeDisplay value={raid.occurredAt.toISOString()} />
            {raid.instanceName && raid.instanceName !== raid.name && (
              <span>{raid.instanceName}</span>
            )}
            <span className="raidDetail-stage">
              {raid.stageNameSnapshot || "Стадия не указана"}
            </span>
          </div>
        </div>
        {hasFinancialHistory ? (
          <p className="raidDetail-lock">
            <LockKeyhole size={14} aria-hidden="true" />
            Рейд зафиксирован и не редактируется
          </p>
        ) : canManage ? (
          <Link className="raidDetail-edit" href={`/raids/${raid.id}/edit`}>
            <Pencil size={14} aria-hidden="true" />
            Редактировать рейд
          </Link>
        ) : null}
      </header>

      <section className="raidDetail-summary" aria-label="Сводка рейда">
        <div className="raidDetail-summaryItem">
          <span>Участники</span>
          <strong>{presentParticipants.length}</strong>
        </div>
        <div className="raidDetail-summaryItem">
          <span>Предметы</span>
          <strong>{raid.lootDrops.length}</strong>
        </div>
      </section>

      <div className="raidDetail-columns">
        <section className="raidDetail-loot" aria-labelledby="raid-loot-heading">
          <div className="raidDetail-sectionHeading">
            <div>
              <h2 id="raid-loot-heading">
                Добыча рейда <span>{raid.lootDrops.length} предметов</span>
              </h2>
              <p>Предметы, количество и время поступления.</p>
            </div>
            {canEditLoot && (
              <Link className="raidDetail-edit" href={`/raids/${raid.id}/edit`}>
                <Plus size={14} aria-hidden="true" />
                Добавить или удалить предмет
              </Link>
            )}
          </div>
          {raid.lootDrops.length === 0 ? (
            <div className="raidDetail-empty">
              <h3>Добычи пока нет</h3>
              <p>Поступления этого рейда появятся здесь после добавления.</p>
              {canEditLoot && <Link href={`/raids/${raid.id}/edit`}>Добавить добычу</Link>}
            </div>
          ) : (
            <ul className="raidDetail-dropList">
              {raid.lootDrops.map((drop) => {
                const itemName = drop.item.displayName || drop.item.canonicalName;

                return (
                  <li key={drop.id} className="raidDetail-drop">
                    <div className="raidDetail-dropHeader">
                      <GameIcon
                        kind="item"
                        name={drop.item.canonicalName}
                        category={drop.item.category}
                        size="lg"
                      />
                      <Link
                        className="raidDetail-itemName"
                        href={`/items/${drop.item.id}`}
                        title={
                          drop.item.displayName && drop.item.displayName !== drop.item.canonicalName
                            ? `${itemName}\n${drop.item.canonicalName}`
                            : itemName
                        }
                      >
                        {itemName}
                      </Link>
                    </div>
                    <dl className="raidDetail-quantities raidDetail-raidLootQuantity">
                      <div>
                        <dt>Добыто</dt>
                        <dd>{drop.quantity} шт.</dd>
                      </div>
                      <div>
                        <dt>Добавлено</dt>
                        <dd>
                          <LocalDateTimeDisplay value={drop.createdAt.toISOString()} />
                        </dd>
                      </div>
                    </dl>
                    {drop.comment && (
                      <details className="raidDetail-dropNote">
                        <summary>
                          Комментарий к предмету <ChevronDown size={14} aria-hidden="true" />
                        </summary>
                        <p className="raidDetail-note">{drop.comment}</p>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="raidDetail-context" aria-label="Состав и заметка рейда">
          <section className="raidDetail-roster" aria-labelledby="raid-roster-heading">
            <div className="raidDetail-rosterHeading">
              <h2 id="raid-roster-heading">Состав рейда</h2>
              <span>{presentParticipants.length} участников</span>
            </div>
            {presentParticipants.length > 0 ? (
              <ul className="raidDetail-rosterGrid">
                {presentParticipants.map((participant) => {
                  const className = participant.classSnapshot;

                  return (
                    <li key={participant.id} className="raidDetail-participant">
                      {className && <GameIcon kind="class" name={className} size="sm" />}
                      <span className="raidDetail-participantText">
                        <strong>{participant.nicknameSnapshot}</strong>
                        <span>{className || "Класс не указан"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="raidDetail-rosterEmpty">
                В рейде нет участников со статусом «В рейде».
              </p>
            )}
            <p className="raidDetail-snapshot">Классы на момент рейда.</p>
          </section>
          {raid.comment && (
            <section className="raidDetail-raidNote" aria-labelledby="raid-note-heading">
              <h2 id="raid-note-heading">Заметка к рейду</h2>
              <p>{raid.comment}</p>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
