import { ExternalHyperlink, HeadingLevel, Paragraph, TextRun } from "docx";

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
] as const;

function inlineRuns(text: string): (TextRun | ExternalHyperlink)[] {
  const parts = text
    .split(/(\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]*?\]\([^)]*?\))/g)
    .filter((p) => p !== "");
  if (!parts.length) return [new TextRun("")];

  return parts.map((part) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return new TextRun({ text: bold[1], bold: true });

    const link = part.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (link) {
      return new ExternalHyperlink({
        link: link[2],
        children: [new TextRun({ text: link[1], color: "0563C1", underline: {} })],
      });
    }

    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) return new TextRun({ text: italic[1], italics: true });

    return new TextRun(part);
  });
}

export function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line || line === "---") continue;

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      paragraphs.push(
        new Paragraph({
          children: inlineRuns(heading[2]),
          heading: HEADING_LEVELS[heading[1].length - 1],
          spacing: { before: 240, after: 100 },
        }),
      );
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      paragraphs.push(
        new Paragraph({ children: inlineRuns(bullet[1]), bullet: { level: 0 }, spacing: { after: 80 } }),
      );
      continue;
    }

    paragraphs.push(new Paragraph({ children: inlineRuns(line), spacing: { after: 120 } }));
  }

  return paragraphs;
}
