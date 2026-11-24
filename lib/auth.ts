import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { one, run } from "./db";
import { devLoginAllowed, env, googleLoginConfigured, isAdminEmail } from "./env";

export type AppUser = { id: string; email: string; name: string | null; image: string | null };

// Our own small users table. Auth.js manages the session, we manage the profile.
export async function upsertUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const existing = await one<AppUser>("SELECT * FROM users WHERE email = ?", [email]);
  if (existing) {
    if ((input.name && input.name !== existing.name) || (input.image && input.image !== existing.image)) {
      await run("UPDATE users SET name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?", [
        input.name ?? null,
        input.image ?? null,
        existing.id,
      ]);
    }
    return existing;
  }
  const user: AppUser = {
    id: randomUUID(),
    email,
    name: input.name ?? email.split("@")[0],
    image: input.image ?? null,
  };
  await run("INSERT INTO users (id, email, name, image) VALUES (?, ?, ?, ?)", [
    user.id,
    user.email,
    user.name,
    user.image,
  ]);
  return user;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  return one<AppUser>("SELECT id, email, name, image FROM users WHERE id = ?", [id]);
}

const providers = [];

if (googleLoginConfigured()) {
  providers.push(
    Google({
      clientId: env("AUTH_GOOGLE_ID"),
      clientSecret: env("AUTH_GOOGLE_SECRET"),
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

// Dev-only email login so the app is testable without Google credentials.
// It is disabled automatically when Google is configured, and by ALLOW_DEV_LOGIN=false.
if (devLoginAllowed()) {
  providers.push(
    Credentials({
      id: "dev-email",
      name: "Developer email login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        if (!devLoginAllowed()) return null;
        const parsed = z.string().email().safeParse(credentials?.email);
        if (!parsed.success) return null;
        const user = await upsertUser({ email: parsed.data, name: parsed.data.split("@")[0] });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env("AUTH_SECRET", "dev-only-insecure-secret-change-me"),
  trustHost: true,
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const stored = await upsertUser({ email: user.email, name: user.name, image: user.image });
      user.id = stored.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const stored = await upsertUser({ email: user.email });
        token.uid = stored.id;
      }
      if (!token.uid && token.email) {
        const stored = await one<AppUser>("SELECT id FROM users WHERE email = ?", [
          String(token.email).toLowerCase(),
        ]);
        if (stored) token.uid = stored.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === "string" ? token.uid : "";
        session.user.isAdmin = isAdminEmail(session.user.email);
      }
      return session;
    },
  },
});
