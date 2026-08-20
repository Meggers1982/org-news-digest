import Link from "next/link";
import { getAllRunDates } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const dates = await getAllRunDates();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        <Link href="/" className="text-sm underline text-black/60 dark:text-white/60">
          Latest
        </Link>
      </header>
      {dates.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No runs recorded yet.</p>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/15">
          {dates.map((date) => (
            <li key={date} className="py-3">
              <Link href={`/history/${date}`} className="hover:underline">
                {date}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
