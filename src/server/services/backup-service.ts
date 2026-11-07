import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import yauzl from "yauzl";
import { pipeline } from "node:stream/promises";
import { Transform, Writable, type Readable } from "node:stream";
import { ZipArchive, type ArchiverError } from "archiver";
import { z } from "zod";

const BACKUP_NAME_PATTERN =
  /^party-bank-\d{8}T\d{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.zip$/i;
const MAX_ARCHIVE_BYTES = 1_000_000_000;
const MAX_UNCOMPRESSED_BYTES = 2_000_000_000;
const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_UPLOAD_DIRECTORIES = 10_000;
const MAX_UPLOAD_DEPTH = 64;
const MAX_MANIFEST_BYTES = 2_000_000;
const REQUIRED_TABLES = [
  "Party",
  "PartyMember",
  "Item",
  "Raid",
  "RaidParticipant",
  "LootDrop",
  "SaleTransaction",
  "SaleShare",
  "MemberPayment",
  "PaymentAllocation",
  "LedgerTransaction",
  "LedgerEntry",
] as const;
const REQUIRED_TRIGGERS = [
  "PartyMember_distributionWeight_insert",
  "PartyMember_distributionWeight_update",
  "RaidParticipant_distributionWeight_insert",
  "RaidParticipant_distributionWeight_update",
  "LootDrop_quantity_insert",
  "LootDrop_quantity_update",
  "RaidParticipant_locked_insert",
  "RaidParticipant_locked_update",
  "RaidParticipant_locked_delete",
  "LootDrop_locked_insert",
  "LootDrop_locked_financial_update",
  "LootDrop_locked_delete",
  "Raid_lockedAt_immutable",
  "SaleTransaction_values_insert",
  "SaleTransaction_values_update",
  "SaleTransaction_oversell_insert",
  "SaleTransaction_oversell_update",
  "SaleTransaction_posted_insert",
  "SaleTransaction_posted_update",
  "SaleTransaction_posted_delete",
  "SaleShare_values_insert",
  "SaleShare_values_update",
  "SaleShare_posted_insert",
  "SaleShare_posted_update",
  "SaleShare_posted_delete",
  "MemberPayment_values_insert",
  "MemberPayment_values_update",
  "MemberPayment_posted_update",
  "MemberPayment_posted_delete",
  "PaymentAllocation_values_insert",
  "PaymentAllocation_values_update",
  "PaymentAllocation_posted_insert",
  "PaymentAllocation_posted_update",
  "PaymentAllocation_posted_delete",
  "LedgerTransaction_source_insert",
  "LedgerTransaction_source_update",
  "LedgerTransaction_balanced_post",
  "LedgerTransaction_lock_raid",
  "LedgerTransaction_posted_delete",
  "LedgerEntry_source_insert",
  "LedgerEntry_source_update",
  "LedgerEntry_posted_delete",
] as const;

const archiveFileSchema = z.object({
  path: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const manifestSchema = z.object({
  formatVersion: z.literal(1),
  createdAt: z.string().datetime(),
  database: archiveFileSchema.extend({ path: z.literal("database.sqlite") }),
  uploads: z.array(
    archiveFileSchema.extend({
      path: z.string().startsWith("uploads/"),
    }),
  ),
});

export type BackupSummary = {
  name: string;
  size: number;
  createdAt: string;
};

export type BackupValidationResult = {
  valid: true;
  databaseSize: number;
  uploadCount: number;
  totalUncompressedSize: number;
};

export class BackupOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupOperationError";
  }
}

function getApplicationRoot() {
  return process.cwd();
}

function resolveConfiguredDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new BackupOperationError("DATABASE_URL не настроен.");
  }

  let url: URL;
  try {
    url = new URL(databaseUrl, pathToFileURL(`${getApplicationRoot()}${path.sep}`));
  } catch {
    throw new BackupOperationError("Поддерживаются только локальные SQLite-файлы.");
  }
  if (url.protocol !== "file:" || url.search || url.hash) {
    throw new BackupOperationError("Поддерживаются только локальные SQLite-файлы.");
  }

  return fileURLToPath(url);
}

function getBackupDirectory() {
  return path.join(getApplicationRoot(), "data", "backups");
}

function getUploadsDirectory() {
  return path.join(getApplicationRoot(), "data", "uploads");
}

function validateBackupName(name: string) {
  if (!BACKUP_NAME_PATTERN.test(name) || path.basename(name) !== name) {
    throw new BackupOperationError("Некорректное имя резервной копии.");
  }
}

async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(filePath)) {
    const data = chunk as Buffer;
    size += data.length;
    hash.update(data);
  }
  return { size, sha256: hash.digest("hex") };
}

async function listUploadFiles(
  root: string,
  relativeDirectory = "",
  traversal = { directories: 0 },
  depth = 0,
): Promise<{ filePath: string; archivePath: string; size: number }[]> {
  traversal.directories += 1;
  if (traversal.directories > MAX_UPLOAD_DIRECTORIES || depth > MAX_UPLOAD_DEPTH) {
    throw new BackupOperationError("Структура папки uploads слишком сложная.");
  }
  const directory = path.join(root, relativeDirectory);
  let directoryStat;
  try {
    directoryStat = await lstat(directory);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new BackupOperationError("Папка uploads содержит небезопасный путь.");
  }
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const result: { filePath: string; archivePath: string; size: number }[] = [];
  for (const entry of entries) {
    const childRelativePath = path.join(relativeDirectory, entry.name);
    const childPath = path.join(/*turbopackIgnore: true*/ root, childRelativePath);
    if (entry.isSymbolicLink()) {
      throw new BackupOperationError("В папке uploads обнаружена символическая ссылка.");
    }
    if (entry.isDirectory()) {
      result.push(...(await listUploadFiles(root, childRelativePath, traversal, depth + 1)));
      continue;
    }
    if (!entry.isFile()) {
      throw new BackupOperationError("В папке uploads найден неподдерживаемый тип файла.");
    }

    const childStat = await lstat(childPath);
    if (childStat.isSymbolicLink()) {
      throw new BackupOperationError("В папке uploads обнаружена символическая ссылка.");
    }
    if (entry.isDirectory() !== childStat.isDirectory() || entry.isFile() !== childStat.isFile()) {
      throw new BackupOperationError("Файл в папке uploads изменился во время проверки.");
    }
    result.push({
      filePath: childPath,
      archivePath: `uploads/${childRelativePath.split(path.sep).join("/")}`,
      size: childStat.size,
    });
    if (result.length > MAX_ARCHIVE_ENTRIES - 2) {
      throw new BackupOperationError("В папке uploads слишком много файлов для архива.");
    }
  }
  if (result.reduce((sum, file) => sum + file.size, 0) > MAX_UNCOMPRESSED_BYTES) {
    throw new BackupOperationError("Общий размер файлов uploads превышает лимит архива.");
  }
  return result;
}

function isSafeArchivePath(name: string) {
  if (
    name.length === 0 ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    path.posix.normalize(name) !== name
  ) {
    return false;
  }

  const segments = name.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isSymbolicLink(entry: yauzl.Entry) {
  const mode = entry.externalFileAttributes >>> 16;
  return (mode & 0o170000) === 0o120000;
}

async function openZip(archivePath: string) {
  return yauzl.openPromise(archivePath, {
    lazyEntries: true,
    autoClose: false,
    validateEntrySizes: true,
    strictFileNames: true,
  });
}

async function consumeEntry(
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry,
  targetPath?: string,
): Promise<{ size: number; sha256: string; content?: Buffer }> {
  const stream = await zipFile.openReadStreamPromise(entry);
  if (targetPath) {
    await mkdir(path.dirname(targetPath), { recursive: true });
  }

  const hash = createHash("sha256");
  let size = 0;
  const chunks: Buffer[] = [];
  const maximumSize =
    entry.fileName === "manifest.json" ? MAX_MANIFEST_BYTES : MAX_UNCOMPRESSED_BYTES;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maximumSize) {
        callback(new BackupOperationError("Файл в архиве превышает допустимый размер."));
        return;
      }
      hash.update(chunk);
      if (entry.fileName === "manifest.json") chunks.push(Buffer.from(chunk));
      callback(null, chunk);
    },
  });
  const destination = targetPath
    ? createWriteStream(targetPath, { flags: "wx" })
    : new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      });

  await pipeline(stream as Readable, meter, destination);
  return {
    size,
    sha256: hash.digest("hex"),
    content: entry.fileName === "manifest.json" ? Buffer.concat(chunks) : undefined,
  };
}

async function validateSqliteDatabase(databasePath: string) {
  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const integrity = database.pragma("integrity_check") as { integrity_check: string }[];
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
      throw new BackupOperationError("SQLite integrity_check обнаружил повреждение базы.");
    }

    const foreignKeyViolations = database.pragma("foreign_key_check") as unknown[];
    if (foreignKeyViolations.length > 0) {
      throw new BackupOperationError("В базе обнаружены нарушения внешних ключей.");
    }

    const tableRows = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tableNames = new Set(tableRows.map(({ name }) => name));
    if (REQUIRED_TABLES.some((tableName) => !tableNames.has(tableName))) {
      throw new BackupOperationError("В базе отсутствуют обязательные таблицы приложения.");
    }

    const triggerRows = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
      .all() as { name: string }[];
    const triggerNames = new Set(triggerRows.map(({ name }) => name));
    if (REQUIRED_TRIGGERS.some((triggerName) => !triggerNames.has(triggerName))) {
      throw new BackupOperationError("В базе отсутствуют обязательные финансовые ограничения.");
    }
  } finally {
    database.close();
  }
}

async function validateArchive(
  archivePath: string,
  extractDirectory?: string,
): Promise<BackupValidationResult> {
  const archiveStat = await lstat(archivePath);
  if (!archiveStat.isFile() || archiveStat.size <= 0 || archiveStat.size > MAX_ARCHIVE_BYTES) {
    throw new BackupOperationError("Размер архива не поддерживается.");
  }

  const zipFile = await openZip(archivePath);
  const seenPaths = new Set<string>();
  const extractedFiles = new Map<string, { size: number; sha256: string }>();
  let manifestContent: Buffer | undefined;
  let totalUncompressedSize = 0;
  let entryCount = 0;

  try {
    for await (const entry of zipFile.eachEntry()) {
      entryCount += 1;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        throw new BackupOperationError("В архиве слишком много файлов.");
      }
      if (
        !isSafeArchivePath(entry.fileName) ||
        isSymbolicLink(entry) ||
        seenPaths.has(entry.fileName)
      ) {
        throw new BackupOperationError("Архив содержит небезопасные или повторяющиеся пути.");
      }
      if (
        entry.fileName !== "manifest.json" &&
        entry.fileName !== "database.sqlite" &&
        !entry.fileName.startsWith("uploads/")
      ) {
        throw new BackupOperationError("Архив содержит неизвестный файл.");
      }
      if (entry.fileName.startsWith("uploads/") && entry.fileName.length <= "uploads/".length) {
        throw new BackupOperationError("Некорректный путь файла uploads в архиве.");
      }

      totalUncompressedSize += entry.uncompressedSize;
      if (entry.uncompressedSize < 0 || totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new BackupOperationError("Распакованный архив превышает допустимый размер.");
      }
      seenPaths.add(entry.fileName);

      const targetPath = extractDirectory
        ? path.join(extractDirectory, ...entry.fileName.split("/"))
        : undefined;
      const result = await consumeEntry(zipFile, entry, targetPath);
      if (entry.fileName === "manifest.json") {
        manifestContent = result.content;
      } else {
        extractedFiles.set(entry.fileName, {
          size: result.size,
          sha256: result.sha256,
        });
      }
    }
  } finally {
    zipFile.close();
  }

  if (!manifestContent) {
    throw new BackupOperationError("В архиве отсутствует manifest.json.");
  }

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestContent.toString("utf8"));
  } catch {
    throw new BackupOperationError("Manifest резервной копии не является корректным JSON.");
  }
  const parsedManifest = manifestSchema.safeParse(rawManifest);
  if (!parsedManifest.success) {
    throw new BackupOperationError("Manifest резервной копии имеет неизвестный формат.");
  }
  const manifest = parsedManifest.data;
  const expectedFiles = [manifest.database, ...manifest.uploads];
  if (expectedFiles.length !== extractedFiles.size) {
    throw new BackupOperationError("Manifest не соответствует содержимому архива.");
  }
  for (const file of expectedFiles) {
    const actual = extractedFiles.get(file.path);
    if (!actual || actual.size !== file.size || actual.sha256 !== file.sha256) {
      throw new BackupOperationError(`Проверка целостности файла ${file.path} не пройдена.`);
    }
  }
  if (seenPaths.size !== extractedFiles.size + 1) {
    throw new BackupOperationError("Архив содержит файлы, не указанные в manifest.");
  }

  if (extractDirectory) {
    await validateSqliteDatabase(path.join(extractDirectory, "database.sqlite"));
  } else {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), "party-bank-backup-validate-"));
    const tempDatabasePath = path.join(tempDirectory, "database.sqlite");
    try {
      await extractDatabaseOnly(archivePath, tempDatabasePath);
      await validateSqliteDatabase(tempDatabasePath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  return {
    valid: true,
    databaseSize: manifest.database.size,
    uploadCount: manifest.uploads.length,
    totalUncompressedSize,
  };
}

async function extractDatabaseOnly(archivePath: string, databasePath: string) {
  const zipFile = await openZip(archivePath);
  try {
    for await (const entry of zipFile.eachEntry()) {
      if (entry.fileName === "database.sqlite") {
        await consumeEntry(zipFile, entry, databasePath);
        return;
      }
    }
  } finally {
    zipFile.close();
  }
  throw new BackupOperationError("В архиве отсутствует database.sqlite.");
}

export async function createLocalBackup(): Promise<BackupSummary> {
  const databasePath = resolveConfiguredDatabasePath();
  const backupDirectory = getBackupDirectory();
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "party-bank-backup-create-"));
  const snapshotPath = path.join(temporaryDirectory, "database.sqlite");
  const createdAt = new Date();
  const timestamp = createdAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const name = `party-bank-${timestamp}-${randomUUID()}.zip`;
  const archivePath = path.join(backupDirectory, name);

  try {
    await mkdir(backupDirectory, { recursive: true });
    const sourceDatabase = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      await sourceDatabase.backup(snapshotPath);
    } finally {
      sourceDatabase.close();
    }

    await validateSqliteDatabase(snapshotPath);
    const uploadFiles = await listUploadFiles(getUploadsDirectory());
    const dbFile = { path: "database.sqlite", ...(await hashFile(snapshotPath)) };
    const uploadRecords = [];
    for (const file of uploadFiles) {
      uploadRecords.push({
        path: file.archivePath,
        ...(await hashFile(file.filePath)),
      });
    }
    const totalSize = dbFile.size + uploadRecords.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_UNCOMPRESSED_BYTES) {
      throw new BackupOperationError("Общий размер данных превышает лимит архива.");
    }

    const manifest = {
      formatVersion: 1,
      createdAt: createdAt.toISOString(),
      database: dbFile,
      uploads: uploadRecords,
    };
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const output = createWriteStream(archivePath, { flags: "wx" });
    const writeComplete = pipeline(archive, output);
    archive.on("warning", (error: ArchiverError) => archive.destroy(error));

    archive.file(snapshotPath, { name: "database.sqlite" });
    for (const file of uploadFiles) {
      archive.file(file.filePath, { name: file.archivePath });
    }
    archive.append(JSON.stringify(manifest), { name: "manifest.json" });
    await archive.finalize();
    await writeComplete;

    await validateArchive(archivePath);
    const archiveStat = await stat(archivePath);
    return {
      name,
      size: archiveStat.size,
      createdAt: createdAt.toISOString(),
    };
  } catch (error) {
    await rm(archivePath, { force: true });
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function listLocalBackups(): Promise<BackupSummary[]> {
  const backupDirectory = getBackupDirectory();
  await mkdir(backupDirectory, { recursive: true });
  const entries = await readdir(backupDirectory, { withFileTypes: true });
  const backups: BackupSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !BACKUP_NAME_PATTERN.test(entry.name)) continue;
    const fileStat = await stat(path.join(backupDirectory, entry.name));
    backups.push({
      name: entry.name,
      size: fileStat.size,
      createdAt: fileStat.mtime.toISOString(),
    });
  }

  return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function validateLocalBackup(name: string) {
  validateBackupName(name);
  const backupPath = path.join(getBackupDirectory(), name);
  try {
    return await validateArchive(backupPath);
  } catch (error) {
    if (error instanceof BackupOperationError) throw error;
    const detail = error instanceof Error ? error.message : "неизвестная ошибка";
    throw new BackupOperationError(`Не удалось проверить резервную копию: ${detail}`);
  }
}

export async function prepareLocalRestore(name: string) {
  validateBackupName(name);
  const backupPath = path.join(getBackupDirectory(), name);
  const candidatesDirectory = path.join(getApplicationRoot(), "data", "restore-candidates");
  await mkdir(candidatesDirectory, { recursive: true });
  const candidatesStat = await lstat(candidatesDirectory);
  if (candidatesStat.isSymbolicLink() || !candidatesStat.isDirectory()) {
    throw new BackupOperationError("Каталог подготовки восстановления небезопасен.");
  }
  const candidateId = `${new Date().toISOString().replace(/[-:.]/g, "")}-${randomUUID()}`;
  const candidateDirectory = path.join(candidatesDirectory, candidateId);
  await mkdir(candidateDirectory, { recursive: false });

  try {
    const result = await validateArchive(backupPath, candidateDirectory);
    return {
      candidateId,
      relativePath: path
        .relative(getApplicationRoot(), candidateDirectory)
        .split(path.sep)
        .join("/"),
      ...result,
    };
  } catch (error) {
    await rm(candidateDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function isValidBackupName(name: string) {
  return BACKUP_NAME_PATTERN.test(name) && path.basename(name) === name;
}
