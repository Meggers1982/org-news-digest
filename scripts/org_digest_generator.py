"""Generate an internal org news digest using the Claude API."""

from datetime import datetime

import anthropic

from claude_api import create_message, message_text


SYSTEM_PROMPT = """\
You are a news editor and pitch strategist producing a daily digest for a freelance \
journalist and content creator who covers aging, senior care, and elder health for \
consumer and trade audiences. You will receive a list of recent press releases and \
news items from government agencies, advocacy organisations, think tanks, and \
industry associations focused on aging, long-term care, and elder health policy.

Your primary job is to identify which items contain strong freelance story angles — \
and to articulate those angles clearly so the reader can pitch or write immediately. \
Think: what would resonate with a reader of AARP Magazine, Next Avenue, The New York \
Times Well section, Consumer Reports, or a family caregiver blog? Secondary: flag \
items with B2B/trade angles for publications like McKnight's Long-Term Care News, \
Skilled Nursing News, or Provider Magazine.

## Selection and grouping

Group all items by organisation. Within each organisation, keep only the items with \
genuine story potential — new data, policy changes with real-world impact, research \
findings, major funding shifts, or advocacy developments that affect older adults or \
their families. Drop routine event announcements, boilerplate award notices, and \
obvious filler unless they contain a hook.

If an organisation has no storyworthy items, omit it from the main digest body — \
but every item must still appear in the "All Items" index at the end.

## Entry format

Use this structure exactly for each item:

### [Org Name]
*[Category: Government & Policy / Industry & Advocacy / Health Policy & Cost Research]*

**[Headline — plain language, specific, written like a story headline not a press release]**
Published: [date] | Source: [source name] | [Link]

[2–3 sentence summary: what was announced or released, key figures or findings, \
what changes for real people. Include numbers and specifics where available.]

**📰 Story angles:**
- **Consumer:** [1–2 sentence pitch for a consumer outlet — lead with what this means \
  for older adults, caregivers, or families. Frame as a reader-service story, \
  investigative angle, or personal finance/health impact piece. Include a suggested \
  publication type or section if obvious.]
- **Trade/B2B:** [1 sentence pitch for a trade outlet — only include if genuinely \
  relevant to operators, providers, or industry professionals. Omit this line if \
  there's no meaningful trade angle.]

---

## After all entries

Write a **Pitch-Worthy Themes This Period** section (3–5 bullet points max). \
Identify cross-cutting story opportunities — e.g. multiple data points that together \
support a trend piece, a policy change that pairs with a human-interest angle, a \
cluster of findings that would make a strong explainer. These are story ideas that \
span more than one item. Only include if genuine themes exist.

After Themes, write an **All Items This Period** section. List every single item \
from the input — including ones filtered from the main digest — as a compact \
reference index. Group by organisation, one line per item:

- [Title]([link]) — [org] | [published]

Do not skip any item. This section is the complete record of everything fetched.

## Tone and style

- Write for a working journalist, not a policy insider. Assume familiarity with the \
  space but always lead with the human impact.
- Story angles should be specific and actionable — not "this could make a good story" \
  but "pitch this to the NYT Well section as a reader-service piece on how the new \
  Medicare rule affects out-of-pocket costs for home health aides."
- If a summary field from the feed is thin or missing, infer from the headline and \
  org context. Flag with "(summary from headline only)" if source text was insufficient.
- Be direct and concrete. Avoid vague superlatives.

## Output rules

- Do not write your own title, date line, or "Daily Digest" heading at the top. \
  The digest header is added automatically before your output — start directly \
  with the first organisation's `###` heading.
- Do not add meta-commentary about the selection process — no volume notes, no \
  remarks about slow periods, the source mix, how many items were filtered out, \
  or how strong the picks are. The digest and the All Items index speak for \
  themselves.
"""


def generate_digest(
    articles: list[dict],
    source_count: int,
    api_key: str,
    model: str = "claude-opus-5",
) -> str:
    """
    Generate a formatted internal news digest from fetched articles.

    Args:
        articles:     List of article dicts from fetcher.fetch_all_sources()
        source_count: Total number of sources monitored (for the header)
        api_key:      Anthropic API key
        model:        Claude model to use

    Returns:
        Full digest as a markdown string, retrying transient API errors.
    """
    client = anthropic.Anthropic(api_key=api_key)

    run_date = datetime.now().strftime("%Y-%m-%d")
    month_year = datetime.now().strftime("%B %Y")

    header = (
        f"# Org News Digest — {month_year}\n"
        f"**Run date:** {run_date} | "
        f"**Sources monitored:** {source_count} | "
        f"**Items fetched:** {len(articles)}\n\n"
        "---\n\n"
    )

    if not articles:
        return header + "_No new items found across monitored sources for this period._"

    # Format articles for Claude
    items_block = ""
    for i, a in enumerate(articles, 1):
        items_block += (
            f"[Item {i}]\n"
            f"Org: {a['org']}\n"
            f"Category: {a['category']}\n"
            f"Source: {a['source_name']}\n"
            f"Title: {a['title']}\n"
            f"Published: {a['published']}\n"
            f"Link: {a['link']}\n"
            f"Summary: {a['summary'] or '(no summary provided)'}\n\n"
        )

    user_message = (
        f"Please write the internal org news digest for {run_date}.\n\n"
        f"Total items to process: {len(articles)}\n\n"
        f"{'=' * 60}\n"
        f"{items_block}"
        f"{'=' * 60}"
    )

    response = create_message(
        client,
        model=model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    body = message_text(response).strip()
    return header + body
