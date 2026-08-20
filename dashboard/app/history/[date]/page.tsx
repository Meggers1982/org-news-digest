import Link from "next/link";
import { getRunsForDate } from "@/lib/db";
import DigestSection from "../../components/DigestSection";

export const dynamic = "force-dynamic";

export default async function HistoryDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const runs = await getRunsForDate(date);
  const press = runs.find((r) => r.digest_type === "press") ?? null;
  const org = runs.find((r) => r.digest_type === "org") ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{date}</h1>
        <Link href="/history" className="text-sm underline text-black/60 dark:text-white/60">
          All history
        </Link>
      </header>
      <DigestSection run={press} />
      <DigestSection run={org} />
    </main>
  );
}
