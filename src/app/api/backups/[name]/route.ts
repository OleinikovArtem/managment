import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { NextResponse } from "next/server";
import { isValidBackupName } from "@/server/services/backup-service";

type BackupRouteContext = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: BackupRouteContext) {
  const { name } = await params;
  if (!isValidBackupName(name)) {
    return NextResponse.json({ error: "Backup not found." }, { status: 404 });
  }

  const archivePath = path.join(process.cwd(), "data", "backups", name);
  try {
    const archiveStat = await lstat(archivePath);
    if (!archiveStat.isFile()) {
      return NextResponse.json({ error: "Backup not found." }, { status: 404 });
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return NextResponse.json({ error: "Backup not found." }, { status: 404 });
    }
    throw error;
  }

  const stream = createReadStream(archivePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
