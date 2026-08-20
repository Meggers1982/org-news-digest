"""Shared Claude API call wrapper.

Both digest generators make a single large completion per run inside an
unattended cron job, so a transient 429/5xx should be retried rather than
killing the whole invocation. The SDK already retries twice internally; this
adds a slower outer loop for the longer outages that outlast those retries.
"""

import time

import anthropic

MAX_ATTEMPTS = 3


def _is_transient(exc: anthropic.APIStatusError) -> bool:
    return bool(exc.status_code) and (exc.status_code >= 500 or exc.status_code == 429)


def message_text(message) -> str:
    """Concatenate a response's text blocks.

    Never index content[0] directly: models that think (Opus 5 does by default)
    put a ThinkingBlock first, so the answer is not necessarily the first block.
    """
    text = "".join(block.text for block in message.content if block.type == "text")
    if not text.strip():
        raise RuntimeError(
            f"Claude returned no text (stop_reason={message.stop_reason})."
        )
    return text


def create_message(client: anthropic.Anthropic, **kwargs):
    """Call client.messages.create, retrying transient failures with backoff."""
    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.messages.create(**kwargs)
            if response.stop_reason == "refusal":
                detail = getattr(response.stop_details, "explanation", "") or ""
                raise RuntimeError(f"Claude declined the request. {detail}".strip())
            if response.stop_reason == "max_tokens":
                print("⚠️  Response hit max_tokens — the digest may be truncated.")
            return response
        except anthropic.APIStatusError as exc:
            if not _is_transient(exc):
                raise
            last_error = exc
            label = f"Anthropic {exc.status_code} error"
        except anthropic.APIConnectionError as exc:
            last_error = exc
            label = "Anthropic connection error"

        if attempt < MAX_ATTEMPTS:
            wait = 15 * attempt
            print(f"⚠️  {label} (attempt {attempt}/{MAX_ATTEMPTS}), retrying in {wait}s…")
            time.sleep(wait)

    raise last_error
