"""Generate the press-highlights digest using the Claude API.

Ported from morning-press-digest's curate_and_format(), adapted to:
- consume the shared fetcher.fetch_all_sources() article shape
- emit clean Markdown (## headers, - bullets) instead of Unicode box-drawing
  dividers, so it renders identically to the org-watch digest in the dashboard
- return a header + body string, matching org_digest_generator's shape, so
  main.py can store both digest types the same way
"""

import time
from datetime import datetime

import anthropic


def generate_digest(
    articles: list[dict],
    source_count: int,
    api_key: str,
    preferences: str = "",
    model: str = "claude-opus-4-8",
) -> str:
    """
    Generate a formatted press-highlights digest from fetched articles.

    Args:
        articles:     List of article dicts from fetcher.fetch_all_sources()
        source_count: Total number of press feeds monitored (for the header)
        api_key:      Anthropic API key
        preferences:  Freeform text from preferences/press_preferences.md
        model:        Claude model to use

    Returns:
        Full digest as a markdown string, retrying up to 3 times on
        transient (5xx) API errors.
    """
    run_date = datetime.now().strftime("%B %d, %Y")

    header = (
        f"# Press Highlights — {run_date}\n"
        f"**Sources monitored:** {source_count} | **Items fetched:** {len(articles)}\n\n"
        "---\n\n"
    )

    if not articles:
        return header + "_No new releases were found in the last 24 hours._"

    client = anthropic.Anthropic(api_key=api_key)

    releases_text = "\n\n".join(
        f"[{a['source_name']}] {a['title']}\n{a['summary']}\n{a['link']}"
        for a in articles
    )

    prefs_section = (
        f"\n\nPERSONAL PREFERENCES (prioritize these above all else):\n{preferences}\n"
        if preferences else ""
    )

    prompt = f"""You are curating a morning press release digest. Today is {run_date}.
{prefs_section}
Below are press releases from the last 24 hours across Business Wire and PR Newswire:

{releases_text}

Select 15–20 of the most genuinely interesting releases and format them as a Markdown digest.

DEFAULT SELECTION CRITERIA (defer to Personal Preferences above if provided):

Actively seek:
- FDA approvals and regulatory decisions
- Clinical trial results (Phase 2/3 data, breakthrough designations)
- Research studies, polls, surveys with surprising or meaningful findings
- Consumer brand launches, category expansions, international market entries
- Notable public health findings or medical breakthroughs
- Unexpected collaborations or cultural moments

Skip entirely:
- Funding rounds and VC announcements
- B2B acquisitions with no direct consumer angle
- Routine earnings reports
- Conference participation / speaker announcements
- Minor personnel announcements
- Dividend declarations
- Boilerplate product updates with no meaningful news hook

Use this exact Markdown structure:

Good morning! Here are today's most interesting press releases from Business Wire and PR Newswire.

## [Category Name]

- **[Headline]** — [One sentence on why it matters]. [[Business Wire or PR Newswire]]([URL])

Repeat for each category. Use headers that fit the stories (e.g. FDA & Regulatory, Clinical Trials, Mental Health, Pharmaceuticals, Fitness & Wellness, Research & Science, AI & Technology, Consumer, Food & Beverage, Fashion, Entertainment, Travel). Omit categories with no strong picks. Output valid Markdown only — no ASCII art, no box-drawing characters.
"""

    last_error = None
    for attempt in range(1, 4):
        try:
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            return header + message.content[0].text
        except anthropic.InternalServerError as e:
            last_error = e
            wait = 15 * attempt
            print(f"⚠️  Anthropic 500 error (attempt {attempt}/3), retrying in {wait}s…")
            time.sleep(wait)
        except anthropic.APIStatusError as e:
            if e.status_code and e.status_code >= 500:
                last_error = e
                wait = 15 * attempt
                print(f"⚠️  Anthropic {e.status_code} error (attempt {attempt}/3), retrying in {wait}s…")
                time.sleep(wait)
            else:
                raise

    raise last_error
