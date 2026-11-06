CREATE TABLE "PartyTelegramBotConfig" (
    "partyId" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "initializationVector" TEXT NOT NULL,
    "authenticationTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyTelegramBotConfig_pkey" PRIMARY KEY ("partyId")
);

ALTER TABLE "PartyTelegramBotConfig" ADD CONSTRAINT "PartyTelegramBotConfig_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
