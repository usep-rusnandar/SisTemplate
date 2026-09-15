#!/usr/bin/env python3
"""Read-only export of commodity master-data sets to seed-shaped JSON.

Reads WIPE_SQL_CONNECTION (ADO.NET-style) from the environment. Never prints
the connection string or password. Writes files under --out-dir.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SET_KEYS = (
    "commodity-category",
    "commodity-classification",
    "commodity-subclassification",
    "commodity-subclassification-kbli",
    "commodity-subclassification-special-requirement",
)


def grab(cs: str, name: str, default: str = "") -> str:
    match = re.search(rf"(?:^|;){re.escape(name)}=([^;]*)", cs, re.I)
    return match.group(1).strip() if match else default


def parse_payload(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def payload_get(payload: dict, *names: str) -> str:
    lowered = {str(key).lower(): value for key, value in payload.items()}
    for name in names:
        value = lowered.get(name.lower())
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def natural_code_key(code: str):
    parts = re.split(r"(\d+)", code or "")
    key = []
    for part in parts:
        if part.isdigit():
            key.append((1, int(part)))
        else:
            key.append((0, part))
    return tuple(key)


def to_seed_rows(set_key: str, rows: list[dict]) -> list[dict]:
    ordered = sorted(rows, key=lambda row: natural_code_key(row["code"]))
    if set_key == "commodity-category":
        return [
            {"CategoryId": row["code"], "CategoryDesc": row["name"]}
            for row in ordered
        ]
    if set_key == "commodity-classification":
        out = []
        for row in ordered:
            payload = parse_payload(row.get("payload"))
            category_id = row.get("parent") or payload_get(payload, "categoryId", "CategoryId")
            out.append(
                {
                    "ClassificationId": row["code"],
                    "ClassificationDesc": row["name"],
                    "CategoryId": category_id,
                }
            )
        return out
    if set_key == "commodity-subclassification":
        out = []
        for row in ordered:
            payload = parse_payload(row.get("payload"))
            classification_id = row.get("parent") or payload_get(
                payload, "classificationId", "ClassificationId"
            )
            out.append(
                {
                    "SubClassificationId": row["code"],
                    "SubClassificationDesc": row["name"],
                    "ClassificationId": classification_id,
                }
            )
        return out
    if set_key == "commodity-subclassification-special-requirement":
        out = []
        for row in ordered:
            payload = parse_payload(row.get("payload"))
            sub_id = payload_get(payload, "subClassificationId", "SubClassificationId")
            req_id = payload_get(payload, "specialReqId", "SpecialReqId") or row["name"]
            if not sub_id:
                code = row["code"]
                sub_id = code.split("|", 1)[0] if "|" in code else code
            out.append({"SubClassificationId": sub_id, "SpecialReqId": req_id})
        return sorted(
            out,
            key=lambda item: (
                natural_code_key(item["SubClassificationId"]),
                item["SpecialReqId"],
            ),
        )
    if set_key == "commodity-subclassification-kbli":
        pairs = []
        for row in ordered:
            payload = parse_payload(row.get("payload"))
            sub_id = payload_get(payload, "subClassificationId", "SubClassificationId") or row["code"]
            kbli_id = payload_get(payload, "kbliId", "KbliId")
            if kbli_id:
                pairs.append({"SubClassificationId": sub_id, "KbliId": kbli_id})
                continue
            groups = payload.get("groups")
            if isinstance(groups, list):
                for group in groups:
                    ids = group if isinstance(group, list) else [group]
                    for kbli in ids:
                        text = str(kbli).strip() if kbli is not None else ""
                        if text:
                            pairs.append({"SubClassificationId": sub_id, "KbliId": text})
        deduped = {(item["SubClassificationId"], item["KbliId"]): item for item in pairs}
        return sorted(
            deduped.values(),
            key=lambda item: (
                natural_code_key(item["SubClassificationId"]),
                item["KbliId"],
            ),
        )
    raise SystemExit(f"Unsupported set {set_key}")


def connect(cs: str):
    import pymssql

    server = grab(cs, "Server") or grab(cs, "Data Source")
    database = grab(cs, "Database") or grab(cs, "Initial Catalog")
    user = grab(cs, "User Id") or grab(cs, "User ID") or grab(cs, "Uid")
    password = grab(cs, "Password") or grab(cs, "Pwd")
    host, port = (server.split(",", 1) + ["1433"])[:2]
    host = host.strip()
    port = int(re.sub(r"\D", "", port) or "1433")
    print(f"Connecting database={database} host={host} port={port} (password masked)")
    return pymssql.connect(
        server=host,
        port=port,
        user=user,
        password=password,
        database=database,
        timeout=120,
        login_timeout=45,
        tds_version="7.4",
    )


def fetch_set(cursor, set_key: str) -> list[dict]:
    cursor.execute(
        """
        SELECT Code, Name, Status, ParentCode, PayloadJson, CreatedAt, UpdatedAt
        FROM core.MASTER_DATA_RECORD_T
        WHERE SetKey = %s
        ORDER BY Code
        """,
        (set_key,),
    )
    rows = []
    for code, name, status, parent, payload, created, updated in cursor.fetchall():
        rows.append(
            {
                "code": code or "",
                "name": name or "",
                "status": status or "",
                "parent": parent or "",
                "payload": payload or "",
                "createdAt": created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
                "updatedAt": updated.isoformat() if hasattr(updated, "isoformat") else str(updated or ""),
            }
        )
    return rows


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", default="commodity-export", help="Directory for JSON files")
    args = parser.parse_args()
    cs = os.environ.get("WIPE_SQL_CONNECTION") or ""
    if not cs.strip():
        print("WIPE_SQL_CONNECTION is empty", file=sys.stderr)
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = out_dir / "raw"
    raw_dir.mkdir(exist_ok=True)

    conn = connect(cs)
    cursor = conn.cursor()
    summary = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "sets": {},
    }
    try:
        for set_key in SET_KEYS:
            rows = fetch_set(cursor, set_key)
            write_json(raw_dir / f"{set_key}.json", rows)
            seed_rows = to_seed_rows(set_key, rows)
            write_json(out_dir / f"{set_key}.json", seed_rows)
            statuses = {}
            for row in rows:
                statuses[row["status"] or "(blank)"] = statuses.get(row["status"] or "(blank)", 0) + 1
            summary["sets"][set_key] = {
                "rowCount": len(rows),
                "seedCount": len(seed_rows),
                "statuses": statuses,
            }
            print(f"{set_key}: {len(rows)} rows -> {len(seed_rows)} seed records {statuses}")
    finally:
        cursor.close()
        conn.close()

    write_json(out_dir / "summary.json", summary)
    print("Export finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
