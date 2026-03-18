import os
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor


def get_dsn() -> str:
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5433")
    dbname = os.getenv("DB_NAME", "")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "")
    return f"host={host} port={port} dbname={dbname} user={user} password={password}"


@contextmanager
def get_cursor():
    conn = psycopg2.connect(get_dsn())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
    finally:
        conn.close()
