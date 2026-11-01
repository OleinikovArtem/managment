import type { MemberInput } from "@/features/members/member-schema";

type MemberField = keyof MemberInput;

export type MemberActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<MemberField, string[]>>;
    };
