import { cache } from "react";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
};

// Cached per request so a page can call it in several places cheaply.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    isAdmin: Boolean(session.user.isAdmin),
  };
});

export async function requireUser(): Promise<SessionUser | null> {
  return currentUser();
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await currentUser();
  return user?.isAdmin ? user : null;
}
