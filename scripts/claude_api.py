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


def create_message(client: anthropic.Anthropic, **kwargs):
    """Call client.messages.create, retrying transient failures with backoff."""
    last_error = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return client.messages.create(**kwargs)
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
