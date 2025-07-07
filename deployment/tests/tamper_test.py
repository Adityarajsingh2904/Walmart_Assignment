import os
import psycopg2
import pytest

@pytest.fixture
def db_conn():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    yield conn
    conn.close()


def test_ledger_immutable(db_conn):
    with db_conn.cursor() as cur:
        cur.execute("SELECT id, details, hash FROM audit_ledger ORDER BY timestamp DESC LIMIT 1;")
        row = cur.fetchone()
        assert row is not None, "No audit_ledger records found"
        rec_id, details, hash_val = row
        try:
            cur.execute("UPDATE audit_ledger SET details='tampered' WHERE id=%s;", (rec_id,))
            db_conn.commit()
        except Exception:
            db_conn.rollback()
        cur.execute("SELECT details, hash FROM audit_ledger WHERE id=%s;", (rec_id,))
        after = cur.fetchone()
        assert after == (details, hash_val), "Audit ledger record was mutated!"
