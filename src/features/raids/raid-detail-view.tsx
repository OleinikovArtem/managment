import Link from "next/link";
import { ArrowLeft, ChevronDown, LockKeyhole, Pencil, Plus } from "lucide-react";
import type { getRaid } from "@/server/services/raid-service";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { GameIcon } from "@/components/ui/game-icon";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { RaidDetailLootFilter } from "@/features/raids/raid-detail-loot-filter";
import { getRaidLootFilterCounts, getRaidLootSummary } from "@/features/raids/raid-detail-model";
import { RaidSaleEditor, RaidSaleWorkspace } from "@/features/raids/raid-sale-workspace";
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
  const lootRows = raid.lootDrops.map((drop) => ({
    ...drop,
    ...getRaidLootSummary(drop.quantity, drop.saleTransactions),
    totalReceived: drop.saleTransactions.reduce((sum, sale) => sum + sale.totalPrice, 0n),
  }));
  const lootFilterCounts = getRaidLootFilterCounts(
    raid.lootDrops.map(({ quantity, saleTransactions }) => ({
      quantity,
      sales: saleTransactions,
    })),
  );
  const totalReceived = lootRows.reduce((sum, drop) => sum + drop.totalReceived, 0n);
  // Presentation guard only: legacy records can have sales without lockedAt.
  const hasFinancialHistory =
    Boolean(raid.lockedAt) || raid.lootDrops.some((drop) => drop.saleTransactions.length > 0);
  const canAddLoot = canManage && !hasFinancialHistory;

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
            {raid.lockedAt ? "История зафиксирована" : "Есть продажи · состав не редактируется"}
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
        <div className="raidDetail-summaryItem">
          <span>Позиции с продажами</span>
          <strong>{lootFilterCounts.sold}</strong>
        </div>
        <div className="raidDetail-summaryItem raidDetail-summaryMoney">
          <span>Получено за продажи</span>
          <strong title={`${totalReceived.toString()} Adena`}>
            <AdenaAmount amount={totalReceived} /> <small>Adena</small>
          </strong>
        </div>
      </section>

      <div className="raidDetail-columns">
        <section className="raidDetail-loot" aria-labelledby="raid-loot-heading">
          <div className="raidDetail-sectionHeading">
            <div>
              <h2 id="raid-loot-heading">
                Добыча рейда <span>{raid.lootDrops.length} предметов</span>
              </h2>
              <p>Продажи и остатки показаны прямо в карточках предметов.</p>
            </div>
          </div>
          {raid.lootDrops.length === 0 ? (
            <div className="raidDetail-empty">
              <h3>Добычи пока нет</h3>
              <p>Поступления этого рейда появятся здесь после добавления.</p>
              {canAddLoot && <Link href={`/raids/${raid.id}/edit`}>Добавить добычу</Link>}
            </div>
          ) : (
            <RaidSaleWorkspace>
              <RaidDetailLootFilter counts={lootFilterCounts}>
                <ul className="raidDetail-dropList">
                  {lootRows.map((drop) => {
                    const itemName = drop.item.displayName || drop.item.canonicalName;
                    const isComplete = drop.state === "complete";

                    return (
                      <li
                        key={drop.id}
                        className={`raidDetail-drop${isComplete ? " is-complete" : ""}`}
                        data-sale-state={drop.state}
                      >
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
                              drop.item.displayName &&
                              drop.item.displayName !== drop.item.canonicalName
                                ? `${itemName}\n${drop.item.canonicalName}`
                                : itemName
                            }
                          >
                            {itemName}
                          </Link>
                        </div>
                        <div className="raidDetail-dropMeta">
                          <span>{drop.item.category || "Предмет"}</span>
                          {isComplete && <span className="raidDetail-soldStamp">Продано</span>}
                        </div>

                        <dl className="raidDetail-quantities">
                          <div>
                            <dt>Добыто</dt>
                            <dd>{drop.quantity}</dd>
                          </div>
                          <div>
                            <dt>Продано</dt>
                            <dd>{drop.soldQuantity}</dd>
                          </div>
                          <div className={drop.remainingQuantity > 0 ? "is-remaining" : undefined}>
                            <dt>Остаток</dt>
                            <dd>{drop.remainingQuantity}</dd>
                          </div>
                        </dl>

                        <div className={`raidDetail-saleState is-${drop.state}`}>
                          <span>
                            {drop.state === "complete"
                              ? "Продано полностью"
                              : drop.state === "partial"
                                ? "Частично продан"
                                : "Ещё не продан"}
                          </span>
                          {drop.totalReceived > 0n && <AdenaAmount amount={drop.totalReceived} />}
                        </div>

                        <div className="raidDetail-cardActions">
                          {drop.remainingQuantity > 0 && canManage ? (
                            <div className="raidDetail-saleEntry" data-sale-entry>
                              <RaidSaleEditor
                                lootDropId={drop.id}
                                remainingQuantity={drop.remainingQuantity}
                              />
                            </div>
                          ) : isComplete ? (
                            <span className="raidDetail-soldAction">Продано</span>
                          ) : null}

                          {drop.saleTransactions.length > 0 && (
                            <details className="raidDetail-history" data-sale-history>
                              <summary>
                                <span>
                                  История{" "}
                                  <span className="raidDetail-count">
                                    · {drop.saleTransactions.length}
                                  </span>
                                </span>
                                <span className="raidDetail-latestAmount">
                                  Последняя{" "}
                                  <AdenaAmount amount={drop.saleTransactions[0].totalPrice} />
                                </span>
                                <ChevronDown size={15} aria-hidden="true" />
                              </summary>
                              <ul className="raidDetail-saleList">
                                {drop.saleTransactions.map((sale) => (
                                  <li key={sale.id}>
                                    <div className="raidDetail-saleHeading">
                                      <div className="raidDetail-saleMetadata">
                                        <span>{sale.quantitySold} шт.</span>
                                        <LocalDateTimeDisplay
                                          value={sale.receivedAt.toISOString()}
                                        />
                                      </div>
                                      <span className="raidDetail-saleAmount">
                                        <AdenaAmount amount={sale.totalPrice} />
                                      </span>
                                    </div>
                                    <p className="raidDetail-exact">
                                      {sale.totalPrice.toLocaleString("ru-RU")} Adena
                                    </p>
                                    {sale.comment && (
                                      <p className="raidDetail-note">{sale.comment}</p>
                                    )}
                                    <details className="raidDetail-shares">
                                      <summary>
                                        Доли участников <ChevronDown size={14} aria-hidden="true" />
                                      </summary>
                                      <ul>
                                        {sale.shares.map((share) => (
                                          <li key={share.id}>
                                            <span>{share.nicknameSnapshot}</span>
                                            <span className="raidDetail-shareAmount">
                                              <AdenaAmount amount={share.amount} />
                                              <span>
                                                {share.amount.toLocaleString("ru-RU")} Adena
                                              </span>
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </details>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>

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
                  {canAddLoot && (
                    <li className="raidDetail-addTile">
                      <Link href={`/raids/${raid.id}/edit`}>
                        <Plus size={30} strokeWidth={1} aria-hidden="true" />
                        <span>Добавить предмет</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </RaidDetailLootFilter>
            </RaidSaleWorkspace>
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
                  const profileName = participant.profile?.subclassSlot
                    ? `Subclass ${participant.profile.subclassSlot}`
                    : participant.profileSnapshot || "Main";

                  return (
                    <li key={participant.id} className="raidDetail-participant">
                      {className && <GameIcon kind="class" name={className} size="sm" />}
                      <span className="raidDetail-participantText">
                        <strong>{participant.nicknameSnapshot}</strong>
                        <span>
                          {className || "Класс не указан"} · {profileName}
                        </span>
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
            <p className="raidDetail-snapshot">Классы и профили на момент рейда.</p>
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
