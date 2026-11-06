import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/db/prisma";

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
    minPasswordLength: 12,
    maxPasswordLength: 128,
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
