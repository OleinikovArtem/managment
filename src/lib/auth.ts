import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";
import { isValidNewPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_RULE_MESSAGE } from "@/lib/password-policy";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  appName: "Party Bank",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [baseURL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  user: {
    fields: { name: "displayName" },
  },
  disabledPaths: [
    "/sign-in/email",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/verify-email",
    "/is-username-available",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/username": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async context => {
      const registration = context.path === "/sign-up/email";
      if (!registration && !["/change-password", "/reset-password", "/set-password"].includes(context.path)) return;
      const password = registration ? context.body?.password : context.body?.newPassword;
      if (typeof password !== "string" || !isValidNewPassword(password)) {
        throw new APIError("BAD_REQUEST", { message: PASSWORD_RULE_MESSAGE });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const usernameValue = (user as typeof user & { username?: string }).username;
          const expectedEmail = usernameValue
            ? `${usernameValue.toLowerCase()}@users.partybank.invalid`
            : "";
          if (
            !usernameValue ||
            !/^[A-Za-z0-9_.]{3,30}$/.test(usernameValue) ||
            usernameValue !== usernameValue.toLocaleLowerCase("en-US") ||
            user.email !== expectedEmail
          ) {
            throw new APIError("BAD_REQUEST", {
              message: "Регистрация поддерживает только имя пользователя и пароль.",
            });
          }
        },
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      displayUsername: false,
      immutableUsername: true,
    }),
    nextCookies(),
  ],
});
