import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

function encryptionKey() {
  const value = process.env.PARTY_TOKEN_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("PARTY_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key.");
  }
  return Buffer.from(value, "hex");
}

export function encryptTelegramBotToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encryptedToken = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { encryptedToken: encryptedToken.toString("base64"), initializationVector: iv.toString("base64"), authenticationTag: cipher.getAuthTag().toString("base64") };
}

export async function saveTelegramBotToken(partyId: string, token: string) {
  const encrypted = encryptTelegramBotToken(token);
  await prisma.partyTelegramBotConfig.upsert({
    where: { partyId },
    create: {
      partyId,
      ...encrypted,
    },
    update: {
      ...encrypted,
    },
  });
}

export async function removeTelegramBotToken(partyId: string) {
  await prisma.partyTelegramBotConfig.deleteMany({ where: { partyId } });
}

export async function readTelegramBotToken(partyId: string) {
  const config = await prisma.partyTelegramBotConfig.findUniqueOrThrow({ where: { partyId } });
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(config.initializationVector, "base64"));
  decipher.setAuthTag(Buffer.from(config.authenticationTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(config.encryptedToken, "base64")), decipher.final()]).toString("utf8");
}
