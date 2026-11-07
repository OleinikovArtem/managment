export type RaidActionResult =
  | { ok: true; message: string; raidId: string }
  | { ok: false; message: string; stageConflict?: boolean };
