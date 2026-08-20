import { getAllRuns } from "@/lib/db";
import Dashboard from "./components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const runs = await getAllRuns();

  return (
    <>
      <header className="app-header">
        <h1>News Digest</h1>
        <p>Full run history — press highlights and org watch, browsable by date.</p>
      </header>
      <Dashboard runs={runs} />
    </>
  );
}
