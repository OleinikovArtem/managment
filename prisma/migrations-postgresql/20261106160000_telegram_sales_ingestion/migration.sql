-- AlterTable
ALTER TABLE "PartyTelegramBotConfig" ADD COLUMN     "botId" TEXT,
ADD COLUMN     "botUsername" TEXT,
ADD COLUMN     "chatId" TEXT,
ADD COLUMN     "chatTitle" TEXT,
ADD COLUMN     "discoveries" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "lastReceivedAt" TIMESTAMP(3),
ADD COLUMN     "senderId" TEXT,
ADD COLUMN     "senderUsername" TEXT,
ADD COLUMN     "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "webhookId" TEXT,
ADD COLUMN     "webhookSecretHash" TEXT;

-- CreateTable
CREATE TABLE "TelegramSaleImport" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "correctedText" TEXT,
    "sourceHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "allocations" JSONB NOT NULL DEFAULT '[]',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSaleImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramImportRead" (
    "importId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramImportRead_pkey" PRIMARY KEY ("importId","userId")
);

-- CreateTable
CREATE TABLE "TelegramItemAlias" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,

    CONSTRAINT "TelegramItemAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramSaleImport_partyId_createdAt_idx" ON "TelegramSaleImport"("partyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSaleImport_partyId_chatId_messageId_key" ON "TelegramSaleImport"("partyId", "chatId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramItemAlias_partyId_normalizedName_key" ON "TelegramItemAlias"("partyId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "PartyTelegramBotConfig_botId_key" ON "PartyTelegramBotConfig"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyTelegramBotConfig_webhookId_key" ON "PartyTelegramBotConfig"("webhookId");

-- AddForeignKey
ALTER TABLE "TelegramSaleImport" ADD CONSTRAINT "TelegramSaleImport_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramImportRead" ADD CONSTRAINT "TelegramImportRead_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TelegramSaleImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramImportRead" ADD CONSTRAINT "TelegramImportRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramItemAlias" ADD CONSTRAINT "TelegramItemAlias_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramItemAlias" ADD CONSTRAINT "TelegramItemAlias_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
