/**
 * Display formatting only.
 *
 * `run_date` doubles as the URL query value, the sort key and the database
 * lookup key, so the ISO form has to survive everywhere except the screen.
 */
export function usDate(value: string | null | undefined): string {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";
  const iso = raw.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[2]}/${iso[3]}/${iso[1].slice(2)}` : raw;
}
