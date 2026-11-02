import type {
  BackupSummary,
  BackupValidationResult,
} from "@/server/services/backup-service";

export type BackupActionResult =
  | { ok: true; message: string; backup?: BackupSummary }
  | { ok: false; message: string };

export type BackupValidationActionResult =
  | { ok: true; message: string; validation: BackupValidationResult }
  | { ok: false; message: string };

export type RestorePreparationActionResult =
  | {
      ok: true;
      message: string;
      candidate: {
        candidateId: string;
        relativePath: string;
        databaseSize: number;
        uploadCount: number;
      };
    }
  | { ok: false; message: string };
