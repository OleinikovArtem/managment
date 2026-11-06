import { describe, expect, it } from "vitest";
import { isValidNewPassword } from "./password-policy";

describe("new password policy", () => {
  it.each(["abc12345", "пароль12", "Some symbols ! 9", "a".repeat(127) + "1"])("accepts letters and digits: %s", password => {
    expect(isValidNewPassword(password)).toBe(true);
  });
  it.each(["abc1234", "12345678", "abcdefgh", "!!!!!!!!", "a".repeat(128) + "1"])("rejects missing required characters or length: %s", password => {
    expect(isValidNewPassword(password)).toBe(false);
  });
});
