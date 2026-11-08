import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { test as base, expect } from "./fixtures";

type LocalData = {
  db: Pool;
  partyId: string;
  userId: string;
  otherUserId: string;
  item: { id: string; name: string; canonicalName: string };
  addRaid: (quantity?: number) => Promise<string>;
};

export const test = base.extend<{ local: LocalData }>({
  local: async ({ context, baseURL }, provide) => {
    const db = new Pool({ connectionString: process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL });
    try {
      const partyId = `e2e-p1-${randomUUID()}`;
      const user = (await db.query('SELECT id FROM "User" WHERE username=$1', [process.env.E2E_USERNAME])).rows[0];
      const other = (await db.query('SELECT id FROM "User" WHERE id<>$1 ORDER BY id LIMIT 1', [user.id])).rows[0];
      const item = (await db.query('SELECT id,"canonicalName",COALESCE(NULLIF("displayName",\'\'),"canonicalName") AS name FROM "Item" WHERE "partyId" IS NULL AND "isActive" ORDER BY id LIMIT 1')).rows[0];
      if (!other || !item) throw new Error("Local P1 fixtures require the existing second account and shared catalog.");
      await db.query('INSERT INTO "Party" (id,name,"updatedAt") VALUES ($1,$1,NOW())', [partyId]);
      await db.query('INSERT INTO "PartyMembership" (id,"partyId","userId",role) VALUES ($1,$2,$3,\'OWNER\')', [`${partyId}-owner`, partyId, user.id]);
      for (const n of [0, 1]) {
        await db.query('INSERT INTO "PartyMember" (id,"partyId",nickname,"normalizedNickname","className","updatedAt") VALUES ($1,$2,$3,$4,\'Cardinal\',NOW())', [`${partyId}-member-${n}`, partyId, `Hero${n}`, `hero${n}`]);
      }
      await db.query('INSERT INTO "PartyMemberProfile" (id,"partyId","memberId",name,"className","subclassSlot","updatedAt") VALUES ($1,$2,$3,\'Subclass 3\',\'Duelist\',3,NOW())', [`${partyId}-profile`, partyId, `${partyId}-member-0`]);
      await context.addCookies([{ name: "party-bank-active-party", value: partyId, url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      await provide({ db, partyId, userId: user.id, otherUserId: other.id, item,
        addRaid: async (quantity = 4) => {
          const raidId = `${partyId}-raid-${randomUUID()}`;
          await db.query('INSERT INTO "Raid" (id,"partyId",name,"occurredAt","updatedAt") VALUES ($1,$2,\'P1 Fixture Raid\',NOW(),NOW())', [raidId, partyId]);
          for (const n of [0, 1]) {
            await db.query('INSERT INTO "RaidParticipant" (id,"partyId","raidId","memberId","nicknameSnapshot",status,"distributionWeight","classSnapshot") VALUES ($1,$2,$3,$4,$5,\'PRESENT\',1,\'Cardinal\')', [randomUUID(), partyId, raidId, `${partyId}-member-${n}`, `Hero${n}`]);
          }
          await db.query('INSERT INTO "LootDrop" (id,"partyId","raidId","itemId",quantity,"updatedAt") VALUES ($1,$2,$3,$4,$5,NOW())', [randomUUID(), partyId, raidId, item.id, quantity]);
          return raidId;
        },
      });
    } finally { await db.end(); }
  },
});
export { expect };
