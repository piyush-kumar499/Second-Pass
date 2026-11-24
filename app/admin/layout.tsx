import Link from "next/link";
import { requireAdmin } from "@/lib/session";

const tabs = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/subjects", label: "Subjects & syllabus" },
  { href: "/admin/papers", label: "Add paper" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/pages", label: "Pages" },
  { href: "/admin/reports", label: "Reports" },
];

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  if (!admin) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center">
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="mt-1 text-sm text-stone-600">
          Log in with an email listed in <code className="font-mono text-xs">ADMIN_EMAILS</code>.
        </p>
        <Link href="/login?next=/admin" className="btn-primary mt-4">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-black tracking-tight">Admin</h1>
        <p className="text-xs text-stone-500">{admin.email}</p>
      </div>
      <nav className="mt-3 -mx-4 overflow-x-auto border-y border-stone-200 bg-white/60 px-4 py-2 sm:mx-0 sm:rounded-xl sm:border">
        <ul className="flex gap-1 text-xs font-semibold">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="inline-block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-stone-600 hover:bg-stone-100"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-4">{children}</div>
    </div>
  );
}
