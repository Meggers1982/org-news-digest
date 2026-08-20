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
    created_at timestamptz not null default now()
);

create table if not exists seen_links (
    link text not null,
    digest_type text not null,
    first_seen date not null,
    primary key (link, digest_type)
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
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into digest_runs (run_date, digest_type, source_count, item_count, markdown)
            values (%s, %s, %s, %s, %s)
            """,
            (run_date, digest_type, source_count, item_count, markdown),
        )
    conn.commit()
