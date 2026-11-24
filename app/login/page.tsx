import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { currentUser } from "@/lib/session";
import { devLoginAllowed, googleLoginConfigured } from "@/lib/env";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";

  return (
    <div className="mx-auto mt-6 max-w-md sm:mt-12">
      <div className="card p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pine-700">Your account</p>
        <h1 className="mt-2 font-serif text-2xl font-bold">Log in to continue</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Browsing and reading saved pages is free. Login is only needed to generate a new page or ask
          the assistant.
        </p>

        {googleLoginConfigured() ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: next });
            }}
            className="mt-5"
          >
            <button type="submit" className="btn-ghost w-full">
              <span className="font-serif text-base font-bold">G</span> Continue with Google
            </button>
          </form>
        ) : null}

        {devLoginAllowed() ? (
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("dev-email", {
                email: String(formData.get("email") ?? ""),
                redirectTo: next,
              });
            }}
            className="mt-5 space-y-3"
          >
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Developer login is on because Google OAuth is not configured. Set{" "}
              <code className="font-mono">ALLOW_DEV_LOGIN=false</code> in production.
            </div>
            <label className="block">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                defaultValue="student@example.com"
              />
            </label>
            <button type="submit" className="btn-primary w-full">
              Continue with email →
            </button>
          </form>
        ) : null}

        {!googleLoginConfigured() && !devLoginAllowed() ? (
          <div className="mt-5 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
            Login is not configured. Add Google OAuth keys or set{" "}
            <code className="font-mono">ALLOW_DEV_LOGIN=true</code> for local testing.
          </div>
        ) : null}

        <p className="mt-5 border-t border-dashed border-line pt-3 text-center text-xs text-stone-500">
          <Link href="/browse" className="link-ink">
            Keep browsing without an account
          </Link>
        </p>
      </div>
    </div>
  );
}
