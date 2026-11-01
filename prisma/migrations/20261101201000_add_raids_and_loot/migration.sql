-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instanceName" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "screenshotPath" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Raid_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaidParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaidParticipant_partyId_raidId_fkey" FOREIGN KEY ("partyId", "raidId") REFERENCES "Raid" ("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RaidParticipant_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember" ("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LootDrop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "screenshotPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LootDrop_partyId_raidId_fkey" FOREIGN KEY ("partyId", "raidId") REFERENCES "Raid" ("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LootDrop_partyId_itemId_fkey" FOREIGN KEY ("partyId", "itemId") REFERENCES "Item" ("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Raid_partyId_occurredAt_idx" ON "Raid"("partyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Raid_partyId_id_key" ON "Raid"("partyId", "id");

-- CreateIndex
CREATE INDEX "RaidParticipant_partyId_memberId_idx" ON "RaidParticipant"("partyId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidParticipant_partyId_raidId_memberId_key" ON "RaidParticipant"("partyId", "raidId", "memberId");

-- CreateIndex
CREATE INDEX "LootDrop_partyId_raidId_createdAt_idx" ON "LootDrop"("partyId", "raidId", "createdAt");

-- CreateIndex
CREATE INDEX "LootDrop_partyId_itemId_createdAt_idx" ON "LootDrop"("partyId", "itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LootDrop_partyId_id_key" ON "LootDrop"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Item_partyId_id_key" ON "Item"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_id_key" ON "PartyMember"("partyId", "id");
