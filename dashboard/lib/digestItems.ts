import type { DigestType } from "./db";

/** One pitchable item out of a digest's markdown -- the row the .csv export
 *  writes, the way senior-research-digest's export writes one row per study. */
export type DigestItem = {
  section: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
};

const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Press format (press_digest_generator.py):
 *    ## Category
 *    - **Headline** — Why it matters. [PR Newswire](https://...)  */
function parsePress(markdown: string): DigestItem[] {
  const items: DigestItem[] = [];
  let section = "";
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      section = stripMarkdown(heading[1]);
      continue;
    }
    const entry = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*[—–-]?\s*(.*)$/);
    if (!entry || !section) continue;
    const link = entry[2].match(new RegExp(`${LINK.source}\\s*$`));
    items.push({
      section,
      headline: stripMarkdown(entry[1]),
      summary: stripMarkdown(link ? entry[2].slice(0, link.index) : entry[2]),
      source: link ? link[1] : "",
      url: link ? link[2] : "",
    });
  }
  return items;
}

/** Org format (org_digest_generator.py), one block per entry:
 *    ### Org Name
 *    *Category*
 *    **Headline**
 *    Published: date | Source: name | [Link](https://...)
 *    Summary paragraph.
 *    **📰 Story angles:** ...
 *  The themes and "All Items" index that follow the entries are not entries. */
function parseOrg(markdown: string): DigestItem[] {
  const items: DigestItem[] = [];
  let current: DigestItem | null = null;
  let inSummary = false;
  const flush = () => {
    if (current?.headline) items.push(current);
    current = null;
    inSummary = false;
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flush();
      if (heading[1] === "##" && /themes|all items/i.test(heading[2])) break;
      if (heading[1] === "###") current = { section: stripMarkdown(heading[2]), headline: "", summary: "", source: "", url: "" };
      continue;
    }
    if (!current) continue;
    if (/^(---|\*\*📰|\*\*story angles)/i.test(line)) {
      inSummary = false;
      continue;
    }
    if (!current.headline) {
      const bold = line.match(/^\*\*(.+)\*\*$/);
      if (bold) current.headline = stripMarkdown(bold[1]);
      continue;
    }
    if (/^published:/i.test(line)) {
      const source = line.match(/source:\s*([^|]+)/i);
      const link = line.match(LINK);
      current.source = source ? stripMarkdown(source[1]) : "";
      current.url = link ? link[2] : "";
      inSummary = true;
      continue;
    }
    if (inSummary && line) current.summary = `${current.summary} ${stripMarkdown(line)}`.trim();
  }
  flush();
  return items;
}

export function parseDigestItems(type: DigestType, markdown: string): DigestItem[] {
  return type === "press" ? parsePress(markdown) : parseOrg(markdown);
}

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  // The BOM is what makes Excel read the em dashes as UTF-8 instead of mojibake.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
