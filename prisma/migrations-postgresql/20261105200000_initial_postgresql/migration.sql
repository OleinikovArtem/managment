-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "RaidParticipantStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "LootDropStatus" AS ENUM ('RECEIVED');

-- CreateEnum
CREATE TYPE "DistributionMethod" AS ENUM ('WEIGHTED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('SALE_POSTED', 'PAYOUT_POSTED');

-- CreateEnum
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('PARTY_CASH', 'MEMBER_PAYABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMembership" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartyRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "normalizedNickname" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "comment" TEXT,
    "distributionWeight" INTEGER NOT NULL DEFAULT 1,
    "className" TEXT,
    "level" INTEGER,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMemberProfile" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "role" TEXT,
    "level" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyMemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyComposition" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "focus" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 36,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyComposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyCompositionMember" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "profileId" TEXT,
    "slotOrder" INTEGER NOT NULL DEFAULT 0,
    "roleOverride" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyCompositionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "displayName" TEXT,
    "category" TEXT,
    "grade" TEXT,
    "itemType" TEXT,
    "itemSubtype" TEXT,
    "isRare" BOOLEAN NOT NULL DEFAULT false,
    "gameVersion" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instanceName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "screenshotPath" TEXT,
    "comment" TEXT,
    "lockedAt" TIMESTAMP(3),
    "compositionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidParticipant" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "profileId" TEXT,
    "nicknameSnapshot" TEXT NOT NULL,
    "status" "RaidParticipantStatus" NOT NULL,
    "distributionWeight" INTEGER NOT NULL,
    "classSnapshot" TEXT,
    "roleSnapshot" TEXT,
    "profileSnapshot" TEXT,
    "levelSnapshot" INTEGER,
    "compositionSlot" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaidParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootDrop" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "screenshotPath" TEXT,
    "status" "LootDropStatus" NOT NULL DEFAULT 'RECEIVED',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LootDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleTransaction" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "lootDropId" TEXT NOT NULL,
    "quantitySold" INTEGER NOT NULL,
    "totalPrice" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "distributionMethod" "DistributionMethod" NOT NULL DEFAULT 'WEIGHTED',
    "algorithmVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleShare" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "saleTransactionId" TEXT NOT NULL,
    "raidParticipantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "weightSnapshot" INTEGER NOT NULL,
    "distributionMethod" "DistributionMethod" NOT NULL,
    "algorithmVersion" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPayment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberPaymentId" TEXT NOT NULL,
    "saleShareId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "status" "LedgerTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "saleTransactionId" TEXT,
    "memberPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "partyMemberId" TEXT,
    "debit" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PartyMembership_userId_idx" ON "PartyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMembership_partyId_userId_key" ON "PartyMembership"("partyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_normalizedNickname_key" ON "PartyMember"("partyId", "normalizedNickname");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMember_partyId_id_key" ON "PartyMember"("partyId", "id");

-- CreateIndex
CREATE INDEX "PartyMemberProfile_partyId_memberId_isActive_idx" ON "PartyMemberProfile"("partyId", "memberId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMemberProfile_partyId_id_key" ON "PartyMemberProfile"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PartyMemberProfile_partyId_memberId_name_key" ON "PartyMemberProfile"("partyId", "memberId", "name");

-- CreateIndex
CREATE INDEX "PartyComposition_partyId_updatedAt_idx" ON "PartyComposition"("partyId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyComposition_partyId_id_key" ON "PartyComposition"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PartyComposition_partyId_name_key" ON "PartyComposition"("partyId", "name");

-- CreateIndex
CREATE INDEX "PartyCompositionMember_partyId_memberId_idx" ON "PartyCompositionMember"("partyId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyCompositionMember_partyId_compositionId_memberId_key" ON "PartyCompositionMember"("partyId", "compositionId", "memberId");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Item_normalizedName_key" ON "Item"("normalizedName");

-- CreateIndex
CREATE INDEX "Raid_partyId_occurredAt_idx" ON "Raid"("partyId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Raid_partyId_id_key" ON "Raid"("partyId", "id");

-- CreateIndex
CREATE INDEX "RaidParticipant_partyId_memberId_idx" ON "RaidParticipant"("partyId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidParticipant_partyId_raidId_memberId_key" ON "RaidParticipant"("partyId", "raidId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RaidParticipant_partyId_raidId_id_memberId_key" ON "RaidParticipant"("partyId", "raidId", "id", "memberId");

-- CreateIndex
CREATE INDEX "LootDrop_partyId_raidId_createdAt_idx" ON "LootDrop"("partyId", "raidId", "createdAt");

-- CreateIndex
CREATE INDEX "LootDrop_partyId_itemId_createdAt_idx" ON "LootDrop"("partyId", "itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LootDrop_partyId_id_key" ON "LootDrop"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LootDrop_partyId_raidId_id_key" ON "LootDrop"("partyId", "raidId", "id");

-- CreateIndex
CREATE INDEX "SaleTransaction_partyId_lootDropId_receivedAt_idx" ON "SaleTransaction"("partyId", "lootDropId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTransaction_partyId_id_key" ON "SaleTransaction"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTransaction_partyId_raidId_id_key" ON "SaleTransaction"("partyId", "raidId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleTransaction_partyId_idempotencyKey_key" ON "SaleTransaction"("partyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SaleShare_partyId_memberId_createdAt_idx" ON "SaleShare"("partyId", "memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleShare_partyId_id_key" ON "SaleShare"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleShare_partyId_memberId_id_key" ON "SaleShare"("partyId", "memberId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SaleShare_partyId_saleTransactionId_raidParticipantId_key" ON "SaleShare"("partyId", "saleTransactionId", "raidParticipantId");

-- CreateIndex
CREATE INDEX "MemberPayment_partyId_memberId_paidAt_idx" ON "MemberPayment"("partyId", "memberId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPayment_partyId_id_key" ON "MemberPayment"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPayment_partyId_memberId_id_key" ON "MemberPayment"("partyId", "memberId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPayment_partyId_idempotencyKey_key" ON "MemberPayment"("partyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_partyId_saleShareId_idx" ON "PaymentAllocation"("partyId", "saleShareId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_partyId_memberPaymentId_saleShareId_key" ON "PaymentAllocation"("partyId", "memberPaymentId", "saleShareId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_partyId_id_key" ON "LedgerTransaction"("partyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_partyId_saleTransactionId_key" ON "LedgerTransaction"("partyId", "saleTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_partyId_memberPaymentId_key" ON "LedgerTransaction"("partyId", "memberPaymentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_partyId_accountType_partyMemberId_createdAt_idx" ON "LedgerEntry"("partyId", "accountType", "partyMemberId", "createdAt");

-- AddForeignKey
ALTER TABLE "PartyMembership" ADD CONSTRAINT "PartyMembership_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMembership" ADD CONSTRAINT "PartyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMemberProfile" ADD CONSTRAINT "PartyMemberProfile_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMemberProfile" ADD CONSTRAINT "PartyMemberProfile_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyComposition" ADD CONSTRAINT "PartyComposition_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCompositionMember" ADD CONSTRAINT "PartyCompositionMember_partyId_compositionId_fkey" FOREIGN KEY ("partyId", "compositionId") REFERENCES "PartyComposition"("partyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCompositionMember" ADD CONSTRAINT "PartyCompositionMember_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCompositionMember" ADD CONSTRAINT "PartyCompositionMember_partyId_profileId_fkey" FOREIGN KEY ("partyId", "profileId") REFERENCES "PartyMemberProfile"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_partyId_compositionId_fkey" FOREIGN KEY ("partyId", "compositionId") REFERENCES "PartyComposition"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_partyId_raidId_fkey" FOREIGN KEY ("partyId", "raidId") REFERENCES "Raid"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaidParticipant" ADD CONSTRAINT "RaidParticipant_partyId_profileId_fkey" FOREIGN KEY ("partyId", "profileId") REFERENCES "PartyMemberProfile"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootDrop" ADD CONSTRAINT "LootDrop_partyId_raidId_fkey" FOREIGN KEY ("partyId", "raidId") REFERENCES "Raid"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootDrop" ADD CONSTRAINT "LootDrop_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_partyId_raidId_fkey" FOREIGN KEY ("partyId", "raidId") REFERENCES "Raid"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleTransaction" ADD CONSTRAINT "SaleTransaction_partyId_raidId_lootDropId_fkey" FOREIGN KEY ("partyId", "raidId", "lootDropId") REFERENCES "LootDrop"("partyId", "raidId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleShare" ADD CONSTRAINT "SaleShare_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleShare" ADD CONSTRAINT "SaleShare_partyId_raidId_saleTransactionId_fkey" FOREIGN KEY ("partyId", "raidId", "saleTransactionId") REFERENCES "SaleTransaction"("partyId", "raidId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleShare" ADD CONSTRAINT "SaleShare_partyId_raidId_raidParticipantId_memberId_fkey" FOREIGN KEY ("partyId", "raidId", "raidParticipantId", "memberId") REFERENCES "RaidParticipant"("partyId", "raidId", "id", "memberId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleShare" ADD CONSTRAINT "SaleShare_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPayment" ADD CONSTRAINT "MemberPayment_partyId_memberId_fkey" FOREIGN KEY ("partyId", "memberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_partyId_memberId_memberPaymentId_fkey" FOREIGN KEY ("partyId", "memberId", "memberPaymentId") REFERENCES "MemberPayment"("partyId", "memberId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_partyId_memberId_saleShareId_fkey" FOREIGN KEY ("partyId", "memberId", "saleShareId") REFERENCES "SaleShare"("partyId", "memberId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_partyId_saleTransactionId_fkey" FOREIGN KEY ("partyId", "saleTransactionId") REFERENCES "SaleTransaction"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_partyId_memberPaymentId_fkey" FOREIGN KEY ("partyId", "memberPaymentId") REFERENCES "MemberPayment"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partyId_ledgerTransactionId_fkey" FOREIGN KEY ("partyId", "ledgerTransactionId") REFERENCES "LedgerTransaction"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partyId_partyMemberId_fkey" FOREIGN KEY ("partyId", "partyMemberId") REFERENCES "PartyMember"("partyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
