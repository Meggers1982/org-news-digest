"""Compare a freshly generated digest against the most recent prior digest of the
same type, surface any cross-item pattern that might justify a standalone feature
pitch, and maintain a persistent per-digest-type memory so both of the above can
draw on the digest's full history, not just the single most recent run.

Mirrors senior-research-digest's trends.py, adapted for headline/link items
instead of PMID-backed studies and for Postgres-only persistence (a
`digest_memory` row per digest type) instead of markdown files on disk.
"""

import re

import anthropic

import db
from claude_api import create_message, message_text


def _system_prompt(digest_label: str, digest_context: str) -> str:
    return f"""\
You are a news editor producing a short synthesis to run at the end of {digest_label}, \
{digest_context}

You will be given the digest just written (NEW DIGEST), the most recent prior digest of \
this type if one exists (PREVIOUS DIGEST), and a running cross-run summary (DIGEST MEMORY, \
which may be empty if this is the first run). Write exactly two visible sections plus one \
hidden block, using this structure and headers verbatim:

## Trends & Continuity

Compare the items in the NEW digest against the items in the PREVIOUS digest. Identify \
genuine connections only — do not force a link where none exists. Organize under any of \
these that apply (omit any with nothing to report): **Convergent stories**, **Developing \
threads**, **Reversals or counterpoints**, **New themes**. Name the specific headlines from \
both digests for each point. If there is no previous digest, write only: "_No prior digest \
to compare against yet — this is the first run._"

## Bigger Picture: Feature Pitch

Independent of the comparison above, look across ONLY the items in the NEW digest as a \
batch. Do several of them, taken together, point to a broader trend, an emerging or \
underreported issue, or a storyline that would justify a standalone feature — something \
bigger than any single item's own story angle?

If yes, write:
**The pattern:** what the cross-item thread is, naming the specific headlines from the NEW \
digest that support it (2-3 sentences).
**Why pitch this now:** why this is timely or newsworthy as a larger feature, not just as \
individual items (1-2 sentences).
**Angle:** how a longer feature piece could be framed, and for which audience (1-2 \
sentences).
**Potential outlets:** 3-4 real, currently active publications this specific pitch could go \
to, each its own bullet with a short reason tied to THIS angle (not a generic "they cover \
this topic").

If the items in this batch are disconnected single stories with no genuine cross-item \
pattern, write only: "_No cross-item feature angle identified in this batch._" Do not \
manufacture a pattern that isn't really there.

Finally, revise DIGEST MEMORY in light of the NEW digest and append it as a fenced block \
(used internally — do not explain it, and do not repeat its contents in either visible \
section above):

```digest_memory
## Established patterns
- [recurring threads that have shown up across multiple runs, with representative headlines/dates]

## Emerging threads
- [newer patterns not yet fully established, worth watching in future runs]

## Feature ideas already pitched
- [short log of past "Bigger Picture" pitches, so future runs don't re-pitch the same angle]
```

Keep DIGEST MEMORY tight — a dozen bullets total across all three subsections, not a \
running log of every item ever covered. Merge, prune, or drop items that are stale or no \
longer relevant rather than letting the list grow indefinitely. If DIGEST MEMORY was empty, \
base it only on the NEW digest.
"""


def _parse_named_section(text: str, heading: str) -> str:
    match = re.search(
        rf"^## {re.escape(heading)}\s*\n(.*?)(?=\n## |\Z)", text, re.DOTALL | re.MULTILINE
    )
    return match.group(1).strip() if match else ""


def generate_trends_and_pitch(
    conn,
    digest_type: str,
    digest_label: str,
    digest_context: str,
    new_markdown: str,
    api_key: str,
    model: str,
) -> tuple[str, str]:
    """Return (trends_raw, feature_pitch_raw) markdown for the two visible
    sections. As a side effect, revises and persists this digest type's memory
    row in Postgres so future runs can draw on the full history, not just the
    single most recent digest."""

    previous_markdown = db.get_previous_digest_markdown(conn, digest_type)
    previous_block = (
        previous_markdown if previous_markdown else "(none — this is the first digest of this type)"
    )

    existing_memory = db.get_digest_memory(conn, digest_type)
    memory_block = existing_memory if existing_memory else "(none yet — this is the first run)"

    client = anthropic.Anthropic(api_key=api_key)
    user_message = (
        f"{'=' * 60}\nNEW DIGEST (just written):\n\n{new_markdown}\n\n"
        f"{'=' * 60}\nPREVIOUS DIGEST:\n\n{previous_block}\n\n"
        f"{'=' * 60}\nDIGEST MEMORY:\n\n{memory_block}\n"
        f"{'=' * 60}"
    )

    response = create_message(
        client,
        model=model,
        max_tokens=3072,
        system=_system_prompt(digest_label, digest_context),
        messages=[{"role": "user", "content": user_message}],
    )
    body = message_text(response)

    memory_match = re.search(r"```digest_memory\s*(.*?)```", body, re.DOTALL)
    if memory_match:
        db.save_digest_memory(conn, digest_type, memory_match.group(1).strip())
        body = body[: memory_match.start()].rstrip()

    trends_raw = _parse_named_section(body, "Trends & Continuity")
    feature_pitch_raw = _parse_named_section(body, "Bigger Picture: Feature Pitch")
    return trends_raw, feature_pitch_raw
