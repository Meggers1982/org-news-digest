import Link from "next/link";
import { getLatestRun } from "@/lib/db";
import DigestSection from "./components/DigestSection";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [press, org] = await Promise.all([
    getLatestRun("press"),
    getLatestRun("org"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">News Digest</h1>
        <Link href="/history" className="text-sm underline text-black/60 dark:text-white/60">
          History
        </Link>
      </header>
      <DigestSection run={press} />
      <DigestSection run={org} />
    </main>
  );
}
