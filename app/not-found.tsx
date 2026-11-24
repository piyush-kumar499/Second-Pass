import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-12 max-w-md p-8 text-center">
      <p className="text-4xl font-black text-stone-300">404</p>
      <h1 className="mt-2 text-lg font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-stone-600">
        It may have been hidden after reports, or the link is wrong.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link href="/" className="btn-primary">
          Home
        </Link>
        <Link href="/browse" className="btn-ghost">
          Browse
        </Link>
      </div>
    </div>
  );
}
