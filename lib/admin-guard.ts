import { currentUser, type SessionUser } from "./session";

export async function adminOrError(): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await currentUser();
  if (!user) {
    return { response: Response.json({ ok: false, error: "Login required." }, { status: 401 }) };
  }
  if (!user.isAdmin) {
    return { response: Response.json({ ok: false, error: "Admin only." }, { status: 403 }) };
  }
  return { user };
}
