import { beforeEach, describe, expect, it, vi } from "vitest";
const { access, reset, preview } = vi.hoisted(() => ({
  access: vi.fn(),
  reset: vi.fn(),
  preview: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/party-access", () => ({ requirePartyActionAccess: access }));
vi.mock("@/server/repositories/party-repository", () => ({
  resetPartyData: reset,
  previewPartyReset: preview,
}));
vi.mock("@/server/services/party-service", () => ({ updatePartyName: vi.fn() }));
vi.mock("@/server/services/party-audit-service", () => ({ recordPartyAuditEvent: vi.fn() }));
import { previewPartyResetAction, resetPartyDataAction } from "@/app/(dashboard)/settings/actions";
import { RESET_PARTY_CONFIRMATION } from "./reset-confirmation";

describe("selective reset action", () => {
  beforeEach(() => {
    access.mockReset().mockResolvedValue({ partyId: "owned-party" });
    reset.mockReset();
    preview.mockReset();
  });
  it("requires OWNER before checking even an invalid payload", async () => {
    access.mockRejectedValue(new Error("Access denied"));
    await expect(resetPartyDataAction({})).rejects.toThrow("Access denied");
    expect(access).toHaveBeenCalledExactlyOnceWith("OWNER");
    expect(reset).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { categories: [], confirmation: RESET_PARTY_CONFIRMATION },
    { categories: ["catalog"], confirmation: RESET_PARTY_CONFIRMATION },
    { categories: ["raids"], confirmation: "delete" },
  ])("rejects an incomplete or forbidden selection", async (payload) => {
    expect(await resetPartyDataAction(payload)).toMatchObject({ ok: false });
    expect(reset).not.toHaveBeenCalled();
  });
  it("uses the authenticated party and reports a reset failure without claiming success", async () => {
    reset.mockRejectedValue(new Error("Database failure"));
    expect(
      await resetPartyDataAction({
        partyId: "someone-else",
        categories: ["sales"],
        confirmation: RESET_PARTY_CONFIRMATION,
      }),
    ).toMatchObject({ ok: false });
    expect(reset).toHaveBeenCalledExactlyOnceWith("owned-party", ["sales"]);
  });
  it("limits read-only preview to OWNER and uses the active party", async () => {
    preview.mockResolvedValue({ categories: ["payments"], counts: { payments: 2 } });
    expect(await previewPartyResetAction(["payments"])).toMatchObject({ ok: true });
    expect(access).toHaveBeenCalledExactlyOnceWith("OWNER");
    expect(preview).toHaveBeenCalledExactlyOnceWith("owned-party", ["payments"]);
  });
  it("rejects an empty preview selection without querying repository counts", async () => {
    expect(await previewPartyResetAction([])).toMatchObject({ ok: false });
    expect(access).toHaveBeenCalledExactlyOnceWith("OWNER");
    expect(preview).not.toHaveBeenCalled();
  });
});
