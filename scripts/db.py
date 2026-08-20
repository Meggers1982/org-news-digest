"""Postgres (Neon) persistence for digest runs and cross-run link dedup.

Replaces morning-press-digest's sent_history.json — both digest types now
share one "seen_links" table instead of a per-repo JSON file, and every run's
rendered Markdown is stored in "digest_runs" for the dashboard to read.
"""

import os
from datetime import date, timedelta

import psycopg

SCHEMA = """
create table if not exists digest_runs (
    id serial primary key,
    run_date date not null,
    digest_type text not null check (digest_type in ('press', 'org')),
    source_count int not null,
    item_count int not null,
    markdown text not null,
    trends_raw text,
    feature_pitch_raw text,
    created_at timestamptz not null default now()
);

alter table digest_runs add column if not exists trends_raw text;
alter table digest_runs add column if not exists feature_pitch_raw text;

create table if not exists seen_links (
    link text not null,
    digest_type text not null,
    first_seen date not null,
    primary key (link, digest_type)
);

-- One running cross-run synthesis per digest type, revised each time
-- trends_generator.py compares a new digest against the digest history.
create table if not exists digest_memory (
    digest_type text primary key,
    memory text not null,
    updated_at timestamptz not null default now()
);
"""


def get_connection() -> psycopg.Connection:
    return psycopg.connect(os.environ["DATABASE_URL"])


def ensure_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(SCHEMA)
    conn.commit()


def load_seen_links(conn: psycopg.Connection, digest_type: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "select link from seen_links where digest_type = %s",
            (digest_type,),
        )
        return {row[0] for row in cur.fetchall()}


def record_seen_links(conn: psycopg.Connection, digest_type: str, links: list[str]) -> None:
    # Entries with no link would all collide on the empty string, permanently
    # deduping every future link-less item away — skip them instead.
    links = [link for link in links if link]
    if not links:
        return
    today = date.today()
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into seen_links (link, digest_type, first_seen)
            values (%s, %s, %s)
            on conflict (link, digest_type) do nothing
            """,
            [(link, digest_type, today) for link in links],
        )
    conn.commit()


def prune_seen_links(conn: psycopg.Connection, dedup_days: int) -> None:
    cutoff = date.today() - timedelta(days=dedup_days)
    with conn.cursor() as cur:
        cur.execute("delete from seen_links where first_seen < %s", (cutoff,))
    conn.commit()


def insert_digest_run(
    conn: psycopg.Connection,
    run_date: date,
    digest_type: str,
    source_count: int,
    item_count: int,
    markdown: str,
    trends_raw: str | None = None,
    feature_pitch_raw: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into digest_runs
                (run_date, digest_type, source_count, item_count, markdown, trends_raw, feature_pitch_raw)
            values (%s, %s, %s, %s, %s, %s, %s)
            """,
            (run_date, digest_type, source_count, item_count, markdown, trends_raw, feature_pitch_raw),
        )
    conn.commit()


def get_previous_digest_markdown(conn: psycopg.Connection, digest_type: str) -> str | None:
    """Most recent stored digest of this type, for trend comparison against the
    one about to be generated. Called before that new run is inserted, so this
    naturally excludes it."""
    with conn.cursor() as cur:
        cur.execute(
            """
            select markdown from digest_runs
            where digest_type = %s
            order by run_date desc, created_at desc
            limit 1
            """,
            (digest_type,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def get_digest_memory(conn: psycopg.Connection, digest_type: str) -> str | None:
    with conn.cursor() as cur:
        cur.execute(
            "select memory from digest_memory where digest_type = %s",
            (digest_type,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def save_digest_memory(conn: psycopg.Connection, digest_type: str, memory: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into digest_memory (digest_type, memory, updated_at)
            values (%s, %s, now())
            on conflict (digest_type) do update set memory = excluded.memory, updated_at = now()
            """,
            (digest_type, memory),
        )
    conn.commit()
