import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { ZipArchive } from "archiver";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const root = process.cwd();
const sourceDatabasePath = path.join(root, "prisma", "dev.db");
const testDatabasePath = path.join(root, "prisma", `backup-integration-${process.pid}.db`);
const previousDatabaseUrl = process.env.DATABASE_URL;
const backupDirectory = path.join(root, "data", "backups");
const uploadTestDirectory = path.join(root, "data", "uploads", `backup-test-${randomUUID()}`);
let createdBackupPath: string | undefined;
let restoreCandidatePath: string | undefined;

afterAll(async () => {
  if (previousDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
  if (createdBackupPath && existsSync(createdBackupPath)) {
    await rm(createdBackupPath);
  }
  if (restoreCandidatePath && existsSync(restoreCandidatePath)) {
    await rm(restoreCandidatePath, { recursive: true });
  }
  if (existsSync(testDatabasePath)) {
    await rm(testDatabasePath);
  }
  for (const suffix of ["-shm", "-wal"]) {
    const sidecar = `${testDatabasePath}${suffix}`;
    if (existsSync(sidecar)) await rm(sidecar);
  }
  if (existsSync(uploadTestDirectory)) {
    await rm(uploadTestDirectory, { recursive: true });
  }
});

describe.skipIf(process.env.LEGACY_SQLITE_TESTS !== "1")("legacy SQLite backup service", () => {
  it("creates, validates and stages a complete SQLite and uploads archive", async () => {
    expect(existsSync(sourceDatabasePath)).toBe(true);
    const source = new Database(sourceDatabasePath, { readonly: true });
    try {
      await source.backup(testDatabasePath);
    } finally {
      source.close();
    }

    await mkdir(uploadTestDirectory, { recursive: true });
    const screenshotBytes = Buffer.from("private screenshot fixture");
    const screenshotPath = path.join(uploadTestDirectory, "screenshot.png");
    await writeFile(screenshotPath, screenshotBytes);
    process.env.DATABASE_URL = `file:./prisma/${path.basename(testDatabasePath)}`;
    vi.resetModules();

    const { createLocalBackup, prepareLocalRestore, validateLocalBackup } =
      await import("@/server/services/backup-service");
    const backup = await createLocalBackup();
    createdBackupPath = path.join(backupDirectory, backup.name);

    expect(backup.size).toBeGreaterThan(0);
    const validation = await validateLocalBackup(backup.name);
    expect(validation.valid).toBe(true);
    expect(validation.uploadCount).toBeGreaterThanOrEqual(1);

    const restored = await prepareLocalRestore(backup.name);
    restoreCandidatePath = path.join(root, restored.relativePath.replaceAll("/", path.sep));
    expect(restored.databaseSize).toBeGreaterThan(0);
    expect(restored.uploadCount).toBeGreaterThanOrEqual(1);
    await expect(
      readFile(
        path.join(
          restoreCandidatePath,
          "uploads",
          path.basename(uploadTestDirectory),
          "screenshot.png",
        ),
      ),
    ).resolves.toEqual(screenshotBytes);

    const restoredDatabase = new Database(path.join(restoreCandidatePath, "database.sqlite"), {
      readonly: true,
    });
    try {
      expect(restoredDatabase.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    } finally {
      restoredDatabase.close();
    }
  }, 30_000);

  it("rejects archives with unsafe ZIP paths and rejects untrusted names", async () => {
    const { validateLocalBackup, BackupOperationError } =
      await import("@/server/services/backup-service");
    await mkdir(backupDirectory, { recursive: true });
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    const name = `party-bank-${timestamp}-${randomUUID()}.zip`;
    const archivePath = path.join(backupDirectory, name);
    const archive = new ZipArchive();
    const writing = pipeline(archive, createWriteStream(archivePath));
    archive.append("unsafe", { name: "../outside.txt" });
    await archive.finalize();
    await writing;

    try {
      await expect(validateLocalBackup(name)).rejects.toBeInstanceOf(BackupOperationError);
      await expect(validateLocalBackup("..\\dev.db")).rejects.toBeInstanceOf(BackupOperationError);

      await writeFile(archivePath, "truncated archive");
      await expect(validateLocalBackup(name)).rejects.toBeInstanceOf(BackupOperationError);
    } finally {
      if (existsSync(archivePath)) await rm(archivePath);
    }
  }, 30_000);
});
