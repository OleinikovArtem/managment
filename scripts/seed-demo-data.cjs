/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require("better-sqlite3");

const db = new Database(process.env.DATABASE_PATH || "prisma/dev.db");
const triggerRows = db.prepare("select name, sql from sqlite_master where type='trigger'").all();
const dropTriggers = () => triggerRows.forEach(({ name }) => db.prepare(`drop trigger if exists [${name}]`).run());
const restoreTriggers = () => triggerRows.forEach(({ sql }) => db.exec(sql));
db.pragma("foreign_keys = ON");
const party = db.prepare("select id from Party order by createdAt limit 1").get();
if (!party) throw new Error("Сначала откройте приложение и создайте локальную группу.");
const partyId = party.id;
const now = Date.now();
const iso = (daysAgo, hour = 20) => new Date(now - daysAgo * 86400000 + (hour - 12) * 3600000).toISOString();
const id = (kind, n) => `demo-${kind}-${n}`;
const names = ["Mokpyxa", "Hunterok", "Korsa", "Asteria", "Berserk", "Dancer", "Eclipse", "Frost", "Grom", "Healer", "Iris", "Joker"];
const memberProfiles = [
  [["Main tank", "Shillien Templar", "Tank"], ["Heal alt", "Cardinal", "Healer"]],
  [["Main DD", "Duelist", "Melee DPS"], ["Archer alt", "Sagittarius", "Ranged DPS"]],
  [["Main heal", "Cardinal", "Healer"], ["Recharge", "Shillien Saint", "Healer / Recharge"]],
  [["Bard", "Sword Muse", "Bard"], ["Mage alt", "Mystic Muse", "Mage DPS"]],
  [["Melee buff", "Doomcryer", "Buffer"], ["Clan support", "Dominator", "Buffer"]],
  [["Dancer", "Spectral Dancer", "Dancer"], ["Tank alt", "Shillien Templar", "Tank"]],
  [["Main mage", "Storm Screamer", "Mage DPS"], ["Dark mage", "Soultaker", "Mage DPS"]],
  [["Archer", "Moonlight Sentinel", "Ranged DPS"], ["Rogue alt", "Ghost Sentinel", "Ranged DPS"]],
  [["AOE", "Dreadnought", "AOE DPS"], ["Main DD", "Titan", "Melee DPS"]],
  [["Elf heal", "Eva's Saint", "Healer"], ["Cardinal alt", "Cardinal", "Healer"]],
  [["Dagger", "Wind Rider", "Melee DPS"], ["Dark dagger", "Ghost Hunter", "Melee DPS"]],
  [["Crafter", "Maestro", "Crafter"], ["Spoiler", "Fortune Seeker", "Spoiler"]],
];
const items = [
  ["High-grade Life Stone - Lv. 84", "Materials"], ["Giant's Codex", "Enchant Scroll"], ["Forgotten Book - 3rd", "Skill Book"],
  ["Vesper Noble Breastplate", "Armor"], ["Vesper Caster", "Weapon"], ["Elegia Cutter", "Weapon"], ["Imperial Crusader Breastplate", "Armor"],
  ["Blessed Scroll: Enchant Weapon (S-grade)", "Enchant Scroll"], ["Top-grade Life Stone - Lv. 80", "Materials"],
];

const seed = db.transaction(() => {
  for (const table of ["PaymentAllocation", "LedgerEntry", "LedgerTransaction", "MemberPayment", "SaleShare", "SaleTransaction", "LootDrop", "RaidParticipant", "Raid", "PartyCompositionMember", "PartyComposition", "PartyMemberProfile"]) {
    db.prepare(`delete from "${table}" where id like 'demo-%'`).run();
  }
  const insertMember = db.prepare("insert or ignore into PartyMember (id,partyId,nickname,normalizedNickname,isActive,comment,distributionWeight,createdAt,updatedAt) values (?,?,?,?,?,?,?,?,?)");
  const memberIds = names.map((name, index) => { const existing = db.prepare("select id from PartyMember where partyId=? and normalizedNickname=?").get(partyId, name.toLowerCase()); const memberId = existing?.id || id("member", index + 1); if (!existing) insertMember.run(memberId, partyId, name, name.toLowerCase(), 1, null, 1, iso(35), iso(0)); db.prepare("update PartyMember set className=?, role=?, level=?, distributionWeight=1 where partyId=? and id=?").run(memberProfiles[index][0][1], memberProfiles[index][0][2], 85, partyId, memberId); return memberId; });
  const insertProfile = db.prepare("insert into PartyMemberProfile (id,partyId,memberId,name,className,role,level,note,isActive,createdAt,updatedAt) values (?,?,?,?,?,?,?,?,?,?,?)");
  for (let memberIndex = 0; memberIndex < memberIds.length; memberIndex += 1) for (let profileIndex = 0; profileIndex < memberProfiles[memberIndex].length; profileIndex += 1) { const [profileName, className, role] = memberProfiles[memberIndex][profileIndex]; insertProfile.run(id(`profile-${memberIndex + 1}`, profileIndex + 1), partyId, memberIds[memberIndex], profileName, className, role, 85, "DEMO_SEED · High Five", 1, iso(35), iso(0)); }
  const profileId = (memberIndex, profileIndex = 0) => id(`profile-${memberIndex + 1}`, profileIndex + 1);
  const insertComposition = db.prepare("insert into PartyComposition (id,partyId,name,description,focus,maxMembers,createdAt,updatedAt) values (?,?,?,?,?,?,?,?)");
  const insertCompositionMember = db.prepare("insert into PartyCompositionMember (id,partyId,compositionId,memberId,profileId,slotOrder,roleOverride,note,createdAt) values (?,?,?,?,?,?,?,?,?)");
  const compositions = [
    ["Основной melee", "Стандартная физическая группа с танком, двумя бафферами и саппортом", "Melee", [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[8,1],[10,0],[11,1]]],
    ["Mage party", "Магическая сетка с перезарядом и двумя контролирующими саппортами", "Mage", [[0,1],[2,1],[3,1],[4,0],[5,0],[6,0],[7,1],[9,0],[11,0]]],
    ["Archer party", "Дальний бой с Sword Muse, Cardinal и буфером", "Archer", [[0,0],[1,1],[2,0],[3,0],[4,0],[5,0],[7,0],[9,0],[8,1]]],
    ["Raid balanced", "Универсальный состав для рейд-босса и нестабильного онлайна", "Raid", [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[9,0],[10,0]]],
  ];
  for (let compositionIndex = 0; compositionIndex < compositions.length; compositionIndex += 1) { const [name, description, focus, slots] = compositions[compositionIndex]; const compositionId = id("composition", compositionIndex + 1); insertComposition.run(compositionId, partyId, name, description, focus, 9, iso(20), iso(0)); slots.forEach(([memberIndex, profileIndex], slotOrder) => insertCompositionMember.run(id(`composition-member-${compositionIndex + 1}`, slotOrder + 1), partyId, compositionId, memberIds[memberIndex], profileId(memberIndex, profileIndex), slotOrder, null, null, iso(20))); }
  const insertItem = db.prepare("insert or ignore into Item (id,partyId,canonicalName,normalizedName,displayName,category,grade,itemType,itemSubtype,isRare,gameVersion,comment,createdAt,updatedAt) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const itemIds = items.map(([name, category], index) => { const existing = db.prepare("select id from Item where partyId=? and normalizedName=?").get(partyId, name.toLowerCase()); if (existing) return existing.id; const itemId = id("item", index + 1); insertItem.run(itemId, partyId, name, name.toLowerCase(), null, category, name.includes("84") ? "S84" : name.includes("80") ? "S80" : null, category === "Weapon" ? "Weapon" : category === "Armor" ? "Armor" : null, null, category !== "Materials", "High Five", "DEMO_SEED", iso(35), iso(0)); return itemId; });
  const insertRaid = db.prepare("insert into Raid (id,partyId,name,instanceName,occurredAt,screenshotPath,comment,lockedAt,compositionId,createdAt,updatedAt) values (?,?,?,?,?,?,?,?,?,?,?)");
  const insertParticipant = db.prepare("insert into RaidParticipant (id,partyId,raidId,memberId,profileId,nicknameSnapshot,status,distributionWeight,classSnapshot,roleSnapshot,profileSnapshot,levelSnapshot,createdAt) values (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertDrop = db.prepare("insert into LootDrop (id,partyId,raidId,itemId,quantity,screenshotPath,status,comment,createdAt,updatedAt) values (?,?,?,?,?,?,?,?,?,?)");
  const insertSale = db.prepare("insert into SaleTransaction (id,partyId,raidId,lootDropId,quantitySold,totalPrice,receivedAt,idempotencyKey,distributionMethod,algorithmVersion,createdAt,comment) values (?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertShare = db.prepare("insert into SaleShare (id,partyId,raidId,saleTransactionId,raidParticipantId,memberId,nicknameSnapshot,weightSnapshot,distributionMethod,algorithmVersion,amount,createdAt) values (?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertLedger = db.prepare("insert into LedgerTransaction (id,partyId,type,status,saleTransactionId,memberPaymentId,createdAt,postedAt) values (?,?,?,?,?,?,?,?)");
  const insertEntry = db.prepare("insert into LedgerEntry (id,partyId,ledgerTransactionId,accountType,partyMemberId,debit,credit,createdAt) values (?,?,?,?,?,?,?,?)");
  const totals = new Map(memberIds.map((memberId) => [memberId, 0n]));
  for (let raidIndex = 0; raidIndex < 12; raidIndex += 1) {
    const raidId = id("raid", raidIndex + 1); const day = 3 + raidIndex * 2; const instance = ["Forge of the Gods", "Seed of Annihilation", "Antharas Lair", "Baylor's Isle"][raidIndex % 4];
    insertRaid.run(raidId, partyId, `${instance} · забег ${raidIndex + 1}`, instance, iso(day), null, "DEMO_SEED", null, id("composition", raidIndex % compositions.length + 1), iso(day), iso(day));
    const count = 6 + (raidIndex % 4); const selected = [...Array(count)].map((_, i) => (raidIndex * 3 + i) % memberIds.length);
    const participantIds = new Map();
    for (const index of selected) { const participantId = id(`participant-${raidIndex + 1}`, index); const selectedProfileIndex = (raidIndex + index) % memberProfiles[index].length; const profile = memberProfiles[index][selectedProfileIndex]; participantIds.set(index, participantId); insertParticipant.run(participantId, partyId, raidId, memberIds[index], profileId(index, selectedProfileIndex), names[index], "PRESENT", 1, profile[1], profile[2], profile[0], 85, iso(day)); }
    const dropCount = raidIndex % 3 === 0 ? 2 : 1;
    for (let dropIndex = 0; dropIndex < dropCount; dropIndex += 1) {
      const dropId = id(`drop-${raidIndex + 1}`, dropIndex); const itemIndex = (raidIndex + dropIndex) % itemIds.length; const quantity = dropIndex === 0 ? 1 : 2; insertDrop.run(dropId, partyId, raidId, itemIds[itemIndex], quantity, null, "RECEIVED", "DEMO_SEED", iso(day), iso(day));
      const amount = BigInt(12_000_000 + raidIndex * 3_500_000 + dropIndex * 8_000_000); const saleId = id(`sale-${raidIndex + 1}`, dropIndex); const receivedAt = iso(day, 21); insertSale.run(saleId, partyId, raidId, dropId, 1, amount.toString(), receivedAt, id("key", `${raidIndex + 1}-${dropIndex}`), "WEIGHTED", 1, receivedAt, null);
      const ledgerId = id(`ledger-sale-${raidIndex + 1}`, dropIndex); insertLedger.run(ledgerId, partyId, "SALE_POSTED", "DRAFT", saleId, null, receivedAt, null); insertEntry.run(id(`entry-sale-cash-${raidIndex + 1}`, dropIndex), partyId, ledgerId, "PARTY_CASH", null, amount.toString(), "0", receivedAt);
      let remainder = amount; for (let shareIndex = 0; shareIndex < selected.length; shareIndex += 1) { const memberIndex = selected[shareIndex]; const shareAmount = shareIndex === selected.length - 1 ? remainder : amount / BigInt(selected.length); remainder -= shareAmount; totals.set(memberIds[memberIndex], totals.get(memberIds[memberIndex]) + shareAmount); const shareId = id(`share-${raidIndex + 1}-${dropIndex}`, shareIndex); insertShare.run(shareId, partyId, raidId, saleId, participantIds.get(memberIndex), memberIds[memberIndex], names[memberIndex], 1, "WEIGHTED", 1, shareAmount.toString(), receivedAt); insertEntry.run(id(`entry-sale-member-${raidIndex + 1}-${dropIndex}`, shareIndex), partyId, ledgerId, "MEMBER_PAYABLE", memberIds[memberIndex], "0", shareAmount.toString(), receivedAt); }
    }
  }
  const insertPayment = db.prepare("insert into MemberPayment (id,partyId,memberId,nicknameSnapshot,amount,paidAt,comment,idempotencyKey,createdAt) values (?,?,?,?,?,?,?,?,?)");
  const insertAllocation = db.prepare("insert into PaymentAllocation (id,partyId,memberId,memberPaymentId,saleShareId,amount,createdAt) values (?,?,?,?,?,?,?)");
  for (const [memberId, total] of totals) { if (total <= 0n) continue; const amount = total * 55n / 100n; const index = memberIds.indexOf(memberId); const paidAt = iso(10 + (index % 5), 22); const paymentId = id("payment", index + 1); insertPayment.run(paymentId, partyId, memberId, names[index], amount.toString(), paidAt, "DEMO_SEED · частичная выплата", id("payment-key", index + 1), paidAt); let remaining = amount; const shares = db.prepare("select id, amount from SaleShare where partyId=? and memberId=? order by createdAt").all(partyId, memberId); for (let shareIndex = 0; shareIndex < shares.length && remaining > 0n; shareIndex += 1) { const shareAmount = BigInt(shares[shareIndex].amount); const allocated = shareAmount < remaining ? shareAmount : remaining; insertAllocation.run(id(`allocation-${index + 1}`, shareIndex), partyId, memberId, paymentId, shares[shareIndex].id, allocated.toString(), paidAt); remaining -= allocated; } const ledgerId = id("ledger-payment", index + 1); insertLedger.run(ledgerId, partyId, "PAYOUT_POSTED", "DRAFT", null, paymentId, paidAt, null); insertEntry.run(id("entry-payment-cash", index + 1), partyId, ledgerId, "PARTY_CASH", null, "0", amount.toString(), paidAt); insertEntry.run(id("entry-payment-member", index + 1), partyId, ledgerId, "MEMBER_PAYABLE", memberId, amount.toString(), "0", paidAt); }
  db.prepare("update LedgerTransaction set status='POSTED', postedAt=createdAt where id like 'demo-%'").run();
});
db.pragma("foreign_keys = OFF");
dropTriggers();
try {
  seed();
} finally {
  restoreTriggers();
  db.pragma("foreign_keys = ON");
}
  console.log(`Demo data seeded for party ${partyId}: 12 raids, 12 members, 24 profiles, 4 compositions, sales and payouts.`);
