"use server";

import { revalidatePath } from "next/cache";
import {
  BackupOperationError,
  createLocalBackup,
  isValidBackupName,
  prepareLocalRestore,
  validateLocalBackup,
} from "@/server/services/backup-service";
import type {
  BackupActionResult,
  BackupValidationActionResult,
  RestorePreparationActionResult,
} from "@/features/settings/backup-action-result";
import { ensureLocalWorkspace } from "@/server/bootstrap/local-workspace";

export async function createBackupAction(): Promise<BackupActionResult> {
  await ensureLocalWorkspace();
  try {
    const backup = await createLocalBackup();
    revalidatePath("/settings");
    return { ok: true, message: "Резервная копия создана и проверена.", backup };
  } catch (error) {
    if (error instanceof BackupOperationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function validateBackupAction(
  nameValue: unknown,
): Promise<BackupValidationActionResult> {
  await ensureLocalWorkspace();
  if (typeof nameValue !== "string" || !isValidBackupName(nameValue)) {
    return { ok: false, message: "Некорректное имя резервной копии." };
  }
  try {
    const validation = await validateLocalBackup(nameValue);
    return {
      ok: true,
      message: "Архив и SQLite-база успешно проверены.",
      validation,
    };
  } catch (error) {
    if (error instanceof BackupOperationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function prepareRestoreAction(
  nameValue: unknown,
): Promise<RestorePreparationActionResult> {
  await ensureLocalWorkspace();
  if (typeof nameValue !== "string" || !isValidBackupName(nameValue)) {
    return { ok: false, message: "Некорректное имя резервной копии." };
  }
  try {
    const candidate = await prepareLocalRestore(nameValue);
    return {
      ok: true,
      message: "Проверенная копия подготовлена отдельно; текущие данные не менялись.",
      candidate: {
        candidateId: candidate.candidateId,
        relativePath: candidate.relativePath,
        databaseSize: candidate.databaseSize,
        uploadCount: candidate.uploadCount,
      },
    };
  } catch (error) {
    if (error instanceof BackupOperationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
