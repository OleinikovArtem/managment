import Link from "next/link";
import { ArrowLeft, ChevronDown, LockKeyhole, Pencil } from "lucide-react";
import type { getRaid } from "@/server/services/raid-service";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { LocalDateTimeDisplay } from "@/features/raids/local-date-time-display";
import { RaidSaleEditor, RaidSaleWorkspace } from "@/features/raids/raid-sale-workspace";
import { formatAdena } from "@/lib/adena";
import "./raid-detail-view.css";

type Raid = Awaited<ReturnType<typeof getRaid>>;

/** Raid presentation; all financial data and mutations use the existing contracts. */
export function RaidDetailView({ raid, partyName, canManage }: { raid: Raid; partyName: string; canManage: boolean }) {
  const presentCount = raid.participants.filter(({ status }) => status === "PRESENT").length;
  // Presentation guard only: legacy records can have sales without lockedAt.
  const hasFinancialHistory = Boolean(raid.lockedAt) || raid.lootDrops.some((drop) => drop.saleTransactions.length > 0);

  return (
    <article className="raidDetail-workspace" data-raid-detail>
      <div className="raidDetail-breadcrumb">
        <Link href="/raids"><ArrowLeft size={15} aria-hidden="true" />Рейды</Link>
        <span aria-hidden="true">/</span>
        <span>{partyName}</span>
      </div>

      <header className="raidDetail-header">
        <div className="raidDetail-identity">
          <h1>{raid.name}</h1>
          <div className="raidDetail-metadata">
            <LocalDateTimeDisplay value={raid.occurredAt.toISOString()} />
            {raid.instanceName && raid.instanceName !== raid.name && <span>{raid.instanceName}</span>}
            <span>{raid.stageNameSnapshot || "Стадия не указана"}</span>
          </div>
        </div>
        {hasFinancialHistory ? (
          <p className="raidDetail-lock"><LockKeyhole size={14} aria-hidden="true" />
            {raid.lockedAt ? "История зафиксирована" : "Есть продажи · состав не редактируется"}
          </p>
        ) : canManage ? (
          <Link className="raidDetail-edit" href={`/raids/${raid.id}/edit`}>
            <Pencil size={14} aria-hidden="true" />Редактировать
          </Link>
        ) : null}
      </header>

      <div className="raidDetail-columns">
        <section className="raidDetail-loot" aria-labelledby="raid-loot-heading">
          <div className="raidDetail-sectionHeading">
            <h2 id="raid-loot-heading">Добыча</h2>
            <span>Поступлений: {raid.lootDrops.length}</span>
          </div>
          {raid.lootDrops.length === 0 ? (
            <div className="raidDetail-empty">
              <h3>Добычи пока нет</h3>
              <p>Поступления этого рейда появятся здесь после добавления.</p>
              {!hasFinancialHistory && canManage && <Link href={`/raids/${raid.id}/edit`}>Добавить добычу</Link>}
            </div>
          ) : (
            <RaidSaleWorkspace>
            <ul className="raidDetail-dropList">
              {raid.lootDrops.map((drop) => {
                // Same remaining-quantity expression used by the original screen.
                const sold = drop.saleTransactions.reduce((sum, sale) => sum + sale.quantitySold, 0);
                const remaining = drop.quantity - sold;
                return (
                  <li key={drop.id} className="raidDetail-drop">
                    <div className="raidDetail-dropHeading">
                      <Link href={`/items/${drop.item.id}`} data-loot-name>
                        {drop.item.displayName || drop.item.canonicalName}
                      </Link>
                      {remaining <= 0 && <span className="raidDetail-sold">Продано полностью</span>}
                    </div>
                    {drop.item.displayName && drop.item.displayName !== drop.item.canonicalName && (
                      <p className="raidDetail-originalName">{drop.item.canonicalName}</p>
                    )}
                    <dl className="raidDetail-quantities">
                      <div><dt>Получено</dt><dd>{drop.quantity} <span>шт.</span></dd></div>
                      <div><dt>Продано</dt><dd>{sold} <span>шт.</span></dd></div>
                      <div className={remaining > 0 ? "raidDetail-remaining" : undefined}>
                        <dt>Осталось</dt><dd>{remaining} <span>шт.</span></dd>
                      </div>
                    </dl>
                    {remaining > 0 && canManage && (
                      <div className="raidDetail-saleEntry" data-sale-entry>
                        <RaidSaleEditor lootDropId={drop.id} remainingQuantity={remaining} />
                      </div>
                    )}

                    {drop.saleTransactions.length > 0 && (
                      <details className="raidDetail-history" data-sale-history>
                        <summary>
                          <span>Продажи <span className="raidDetail-count">{drop.saleTransactions.length}</span></span>
                          <span className="raidDetail-latestAmount">
                            <span>Последняя</span> {formatAdena(drop.saleTransactions[0].totalPrice)}
                          </span>
                          <ChevronDown size={15} aria-hidden="true" />
                        </summary>
                        <ul className="raidDetail-saleList">
                          {drop.saleTransactions.map((sale) => (
                            <li key={sale.id}>
                              <div className="raidDetail-saleHeading">
                                <div className="raidDetail-saleMetadata">
                                  <span>{sale.quantitySold} шт.</span>
                                  <LocalDateTimeDisplay value={sale.receivedAt.toISOString()} />
                                </div>
                                <span className="raidDetail-saleAmount"><AdenaAmount amount={sale.totalPrice} /></span>
                              </div>
                              <p className="raidDetail-exact">{sale.totalPrice.toLocaleString("ru-RU")} Adena</p>
                              {sale.comment && <p className="raidDetail-note">{sale.comment}</p>}
                              <details className="raidDetail-shares">
                                <summary>Доли участников <ChevronDown size={14} aria-hidden="true" /></summary>
                                <ul>
                                  {sale.shares.map((share) => (
                                    <li key={share.id}>
                                      <span>{share.nicknameSnapshot}</span>
                                      <span className="raidDetail-shareAmount">
                                        <AdenaAmount amount={share.amount} />
                                        <span>{share.amount.toLocaleString("ru-RU")} Adena</span>
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
                    {drop.comment && (
                      <details className="raidDetail-dropNote">
                        <summary>Заметка к поступлению<ChevronDown size={14} aria-hidden="true" /></summary>
                        <p className="raidDetail-note">{drop.comment}</p>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
            </RaidSaleWorkspace>
          )}
        </section>

        <aside className="raidDetail-context" aria-label="Состав и заметка рейда">
          <details className="raidDetail-roster" open>
            <summary>
              <span><span className="raidDetail-rosterTitle">Состав рейда</span><span className="raidDetail-rosterCount">{presentCount} из {raid.participants.length} присутствовали</span></span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <ul>
              {raid.participants.map((participant) => (
                <li key={participant.id} className={participant.status === "ABSENT" ? "raidDetail-absent" : undefined}>
                  <span className="raidDetail-participantName">{participant.nicknameSnapshot}</span>
                  {[participant.profileSnapshot, participant.classSnapshot, participant.roleSnapshot,
                    participant.levelSnapshot ? `Lv. ${participant.levelSnapshot}` : null].filter(Boolean).length > 0 && (
                    <span className="raidDetail-participantProfile">
                      {[participant.profileSnapshot, participant.classSnapshot, participant.roleSnapshot,
                        participant.levelSnapshot ? `Lv. ${participant.levelSnapshot}` : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {participant.status === "ABSENT" && <span className="raidDetail-participantProfile">Отсутствовал</span>}
                </li>
              ))}
            </ul>
            <p className="raidDetail-snapshot">Имена и профили на момент рейда.</p>
          </details>
          {raid.comment && (
            <section className="raidDetail-raidNote" aria-labelledby="raid-note-heading">
              <h2 id="raid-note-heading">Заметка</h2>
              <p>{raid.comment}</p>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
