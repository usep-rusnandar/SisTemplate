#!/usr/bin/env python3
"""Copy Administrative Regions master data (province/city/district/village).

Export from this VM's SQL, or import a gzipped JSONL snapshot into a destination
SQL (Staging/Production). Never prints connection strings or passwords.

JSONL kinds:
  set      — core.MASTER_DATA_SET_T metadata for the four region keys
  record   — core.MASTER_DATA_RECORD_T rows
  setting  — core.SETTING_T wilayahSyncState (so the UI shows last sync succeeded)
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pymssql

SET_KEYS = ("province", "city", "district", "village")
SETTING_KEY = "wilayahSyncState"
BATCH = 800
INSERT_ROWS = 200


def grab(cs: str, name: str, default: str = "") -> str:
    match = re.search(rf"(?:^|;){re.escape(name)}=([^;]*)", cs, re.I)
    return match.group(1).strip() if match else default


def connection_from_env() -> tuple[str, int, str, str, str]:
    cs = (
        os.environ.get("WIPE_SQL_CONNECTION")
        or os.environ.get("ConnectionStrings__DefaultConnection")
        or os.environ.get("INTEGRATED_PROCUREMENT_CONNECTION")
        or ""
    ).strip()
    if not cs:
        raise SystemExit("No SQL connection in WIPE_SQL_CONNECTION / ConnectionStrings__DefaultConnection")
    server = grab(cs, "Server") or grab(cs, "Data Source")
    database = grab(cs, "Database") or grab(cs, "Initial Catalog")
    user = grab(cs, "User Id") or grab(cs, "User ID") or grab(cs, "Uid") or "sa"
    password = grab(cs, "Password") or grab(cs, "Pwd")
    if not server or not database:
        raise SystemExit("Connection string missing Server or Database")
    host, port = (server.split(",", 1) + ["1433"])[:2]
    host = host.strip()
    port = int(re.sub(r"\D", "", port) or "1433")
    print(f"SQL host={host} port={port} database={database} user={user}")
    return host, port, user, password, database


def connect():
    host, port, user, password, database = connection_from_env()
    return pymssql.connect(
        server=host,
        port=port,
        user=user,
        password=password,
        database=database,
        timeout=600,
        login_timeout=45,
        tds_version="7.4",
    )


def iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def parse_dt(value: str | None):
    if not value:
        return datetime.now(timezone.utc)
    text = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc)


def sql_n(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "N'" + str(value).replace("'", "''") + "'"


def sql_guid(value) -> str:
    return "CONVERT(uniqueidentifier, " + sql_n(str(value)) + ")"


def sql_dto(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return "CONVERT(datetimeoffset, " + sql_n(value.isoformat()) + ")"


def record_value_sql(row: dict) -> str:
    return (
        "("
        + ",".join(
            [
                sql_guid(row["id"]),
                sql_n(row["setKey"]),
                sql_n(row["code"]),
                sql_n(row["name"]),
                sql_n(row.get("status") or "Active"),
                sql_n(row.get("description") or ""),
                sql_n(row.get("payloadJson")),
                sql_n(row.get("parentCode")),
                sql_dto(parse_dt(row.get("createdAt"))),
                sql_dto(parse_dt(row.get("updatedAt"))),
            ]
        )
        + ")"
    )


def export_snapshot(out_path: Path) -> None:
    conn = connect()
    cur = conn.cursor(as_dict=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    with gzip.open(out_path, "wt", encoding="utf-8") as fh:
        cur.execute(
            """
            SELECT [Key], Name, TableName, Owner, IsReadOnly
            FROM core.MASTER_DATA_SET_T
            WHERE [Key] IN ('province','city','district','village')
            """
        )
        for row in cur.fetchall():
            fh.write(json.dumps({"kind": "set", "key": row["Key"], "name": row["Name"],
                                 "tableName": row["TableName"], "owner": row["Owner"],
                                 "isReadOnly": bool(row["IsReadOnly"])}, ensure_ascii=False) + "\n")

        cur.execute(
            """
            SELECT Id, SetKey, Code, Name, Status, Description, PayloadJson, ParentCode, CreatedAt, UpdatedAt
            FROM core.MASTER_DATA_RECORD_T
            WHERE SetKey IN ('province','city','district','village')
            ORDER BY SetKey, Code
            """
        )
        while True:
            rows = cur.fetchmany(BATCH)
            if not rows:
                break
            for row in rows:
                key = row["SetKey"]
                counts[key] = counts.get(key, 0) + 1
                fh.write(json.dumps({
                    "kind": "record",
                    "id": str(row["Id"]),
                    "setKey": key,
                    "code": row["Code"],
                    "name": row["Name"],
                    "status": row["Status"],
                    "description": row["Description"] or "",
                    "payloadJson": row["PayloadJson"],
                    "parentCode": row["ParentCode"],
                    "createdAt": iso(row["CreatedAt"]),
                    "updatedAt": iso(row["UpdatedAt"]),
                }, ensure_ascii=False) + "\n")

        cur.execute("SELECT [Key], ValueJson FROM core.SETTING_T WHERE [Key] = %s", (SETTING_KEY,))
        setting = cur.fetchone()
        if setting:
            fh.write(json.dumps({
                "kind": "setting",
                "key": setting["Key"],
                "valueJson": setting["ValueJson"],
            }, ensure_ascii=False) + "\n")

    cur.close()
    conn.close()
    print("Exported counts: " + ", ".join(f"{k}={counts.get(k, 0)}" for k in SET_KEYS))
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes gzipped)")
    if counts.get("village", 0) < 80_000:
        raise SystemExit("ABORT: village count looks like the 200-row seed, not a full wilayah.id snapshot")


def load_snapshot(path: Path) -> tuple[list[dict], list[dict], dict | None]:
    sets: list[dict] = []
    records: list[dict] = []
    setting = None
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            kind = item.get("kind")
            if kind == "set":
                sets.append(item)
            elif kind == "record":
                records.append(item)
            elif kind == "setting":
                setting = item
    return sets, records, setting


def import_snapshot(path: Path) -> None:
    sets, records, setting = load_snapshot(path)
    by_key: dict[str, int] = {}
    for row in records:
        by_key[row["setKey"]] = by_key.get(row["setKey"], 0) + 1
    print("Snapshot counts: " + ", ".join(f"{k}={by_key.get(k, 0)}" for k in SET_KEYS))
    if by_key.get("village", 0) < 80_000:
        raise SystemExit("ABORT: snapshot village count is too low to replace Staging/Production")
    if by_key.get("province", 0) < 30 or by_key.get("city", 0) < 400 or by_key.get("district", 0) < 6000:
        raise SystemExit("ABORT: snapshot is missing province/city/district coverage")

    conn = connect()
    cur = conn.cursor()
    try:
        cur.execute("SET NOCOUNT ON; SET XACT_ABORT ON;")
        cur.execute(
            "SELECT SetKey, COUNT(*) FROM core.MASTER_DATA_RECORD_T "
            "WHERE SetKey IN ('province','city','district','village') GROUP BY SetKey"
        )
        before = {row[0]: row[1] for row in cur.fetchall()}
        print("Destination before: " + ", ".join(f"{k}={before.get(k, 0)}" for k in SET_KEYS))

        now = datetime.now(timezone.utc)
        for item in sets:
            cur.execute("SELECT 1 FROM core.MASTER_DATA_SET_T WHERE [Key] = %s", (item["key"],))
            if cur.fetchone():
                continue
            cur.execute(
                """
                INSERT INTO core.MASTER_DATA_SET_T
                    (Id, [Key], Name, TableName, Owner, IsReadOnly, CreatedAt, UpdatedAt)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    item.get("id") or uuid.uuid4(),
                    item["key"],
                    item["name"],
                    item["tableName"],
                    item.get("owner") or "VendorOnboarding",
                    1 if item.get("isReadOnly") else 0,
                    now,
                    now,
                ),
            )

        print("Deleting existing region rows…")
        cur.execute(
            "DELETE FROM core.MASTER_DATA_RECORD_T WHERE SetKey IN ('province','city','district','village')"
        )
        print(f"Inserting {len(records)} region rows in {INSERT_ROWS}-row statements…")
        insert_head = (
            "INSERT INTO core.MASTER_DATA_RECORD_T "
            "(Id, SetKey, Code, Name, Status, Description, PayloadJson, ParentCode, CreatedAt, UpdatedAt) "
            "VALUES "
        )
        batch: list[str] = []
        inserted = 0
        for row in records:
            batch.append(record_value_sql(row))
            if len(batch) >= INSERT_ROWS:
                cur.execute(insert_head + ",".join(batch))
                inserted += len(batch)
                batch.clear()
                if inserted % 10_000 == 0 or inserted == len(records):
                    print(f"  inserted {inserted}/{len(records)}", flush=True)
        if batch:
            cur.execute(insert_head + ",".join(batch))
            inserted += len(batch)
        print(f"Inserted {inserted} rows")

        if setting and setting.get("valueJson"):
            cur.execute("SELECT Id FROM core.SETTING_T WHERE [Key] = %s", (SETTING_KEY,))
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    "UPDATE core.SETTING_T SET ValueJson = %s, UpdatedAt = %s WHERE [Key] = %s",
                    (setting["valueJson"], now, SETTING_KEY),
                )
            else:
                cur.execute(
                    "INSERT INTO core.SETTING_T (Id, [Key], ValueJson, CreatedAt, UpdatedAt) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (uuid.uuid4(), SETTING_KEY, setting["valueJson"], now, now),
                )
            print("Upserted wilayahSyncState")

        conn.commit()

        cur.execute(
            "SELECT SetKey, COUNT(*) FROM core.MASTER_DATA_RECORD_T "
            "WHERE SetKey IN ('province','city','district','village') GROUP BY SetKey"
        )
        after = {row[0]: row[1] for row in cur.fetchall()}
        print("Destination after: " + ", ".join(f"{k}={after.get(k, 0)}" for k in SET_KEYS))
        for key in SET_KEYS:
            if after.get(key, 0) != by_key.get(key, 0):
                raise SystemExit(f"ABORT: {key} count mismatch snapshot={by_key.get(key, 0)} db={after.get(key, 0)}")
        print("Copy verified.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    exp = sub.add_parser("export")
    exp.add_argument("--out", required=True, type=Path)
    imp = sub.add_parser("import")
    imp.add_argument("--from", dest="src", required=True, type=Path)
    args = parser.parse_args()
    if args.cmd == "export":
        export_snapshot(args.out)
    else:
        import_snapshot(args.src)


if __name__ == "__main__":
    main()
