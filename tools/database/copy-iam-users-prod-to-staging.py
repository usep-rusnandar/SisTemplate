#!/usr/bin/env python3
"""Copy iam.USER_T + USER_ROLE_T + ManagerUserId from Production onto Staging.

Match users by PersonnelNo. Keep staging Ids for existing rows so FKs stay valid.
Do not copy password hashes. Do not write to Production.
Never prints connection strings or passwords.
"""
from __future__ import annotations

import argparse
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import pymssql

ACTOR = "prod-iam-sync"
TRACKER_OFFICER = "Officer Proposal Tracker"
SAMPLE_HEADS = ("80006600", "00109501", "00107638", "80008913")


def grab(cs: str, name: str, default: str = "") -> str:
    match = re.search(rf"(?:^|;){re.escape(name)}=([^;]*)", cs, re.I)
    return match.group(1).strip() if match else default


def parse_cs(cs: str, label: str) -> tuple[str, int, str, str, str]:
    if not (cs or "").strip():
        raise SystemExit(f"{label} connection string is empty")
    server = grab(cs, "Server") or grab(cs, "Data Source")
    database = grab(cs, "Database") or grab(cs, "Initial Catalog")
    user = grab(cs, "User Id") or grab(cs, "User ID") or grab(cs, "Uid")
    password = grab(cs, "Password") or grab(cs, "Pwd")
    if not server or not database or not user:
        raise SystemExit(f"{label} connection string missing Server, Database, or User Id")
    server = re.sub(r"^tcp:", "", server, flags=re.I).strip()
    host, port = (server.split(",", 1) + ["1433"])[:2]
    host = host.strip()
    port = int(re.sub(r"\D", "", port) or "1433")
    print(f"{label} SQL host={host} port={port} database={database} user={user}")
    return host, port, user, password, database


def connect(cs: str, label: str):
    host, port, user, password, database = parse_cs(cs, label)
    return pymssql.connect(
        server=host,
        port=port,
        user=user,
        password=password,
        database=database,
        timeout=120,
        login_timeout=45,
        tds_version="7.4",
    ), host, database


def norm_nrp(value) -> str:
    return str(value or "").strip()


def as_guid(value) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, bytes):
        return str(uuid.UUID(bytes=value))
    text = str(value).strip()
    if not text:
        return None
    return str(uuid.UUID(text))


def fetch_users(cur) -> list[dict]:
    cur.execute(
        """
        SELECT Id, PersonnelNo, CompleteName, Email, Department, Position, Status,
               ManagerUserId, DeletedAt, DeletedBy
        FROM iam.USER_T
        """
    )
    cols = [c[0] for c in cur.description]
    rows = []
    for raw in cur.fetchall():
        row = dict(zip(cols, raw))
        row["PersonnelNo"] = norm_nrp(row["PersonnelNo"])
        row["Id"] = as_guid(row["Id"])
        row["ManagerUserId"] = as_guid(row.get("ManagerUserId"))
        rows.append(row)
    return rows


def fetch_roles(cur) -> dict[str, str]:
    cur.execute("SELECT Id, Code, Name FROM iam.ROLE_T")
    out = {}
    for role_id, code, _name in cur.fetchall():
        out[str(code).strip()] = as_guid(role_id)
    return out


def fetch_user_role_codes(cur) -> dict[str, set[str]]:
    cur.execute(
        """
        SELECT u.PersonnelNo, r.Code
        FROM iam.USER_ROLE_T ur
        JOIN iam.USER_T u ON u.Id = ur.UserId
        JOIN iam.ROLE_T r ON r.Id = ur.RoleId
        """
    )
    by_nrp: dict[str, set[str]] = defaultdict(set)
    for personnel_no, code in cur.fetchall():
        by_nrp[norm_nrp(personnel_no)].add(str(code).strip())
    return by_nrp


def active_users(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row.get("DeletedAt") is None and str(row.get("Status") or "") == "Active"]


def manager_nrp(users: list[dict], user: dict) -> str:
    if not user.get("ManagerUserId"):
        return ""
    by_id = {row["Id"]: row for row in users}
    manager = by_id.get(user["ManagerUserId"])
    return manager["PersonnelNo"] if manager else ""


def officer_names_under(users: list[dict], roles: dict[str, set[str]], head_nrp: str) -> list[str]:
    by_nrp = {row["PersonnelNo"]: row for row in users if row.get("DeletedAt") is None}
    head = by_nrp.get(head_nrp)
    if not head:
        return []
    children: dict[str, list[dict]] = defaultdict(list)
    for row in users:
        if row.get("DeletedAt") is not None:
            continue
        mgr = manager_nrp(users, row)
        if mgr:
            children[mgr].append(row)
    seen: set[str] = set()
    queue = [head["PersonnelNo"]]
    officers: list[str] = []
    while queue:
        current = queue.pop(0)
        for child in children.get(current, []):
            nrp = child["PersonnelNo"]
            if nrp in seen:
                continue
            seen.add(nrp)
            queue.append(nrp)
            if TRACKER_OFFICER in roles.get(nrp, set()) and child.get("Status") == "Active":
                officers.append(child["CompleteName"])
    return sorted(officers, key=str.casefold)


def print_tree(label: str, users: list[dict], roles: dict[str, set[str]]) -> None:
    print(f"{label} active users={len(active_users(users))}")
    for nrp in SAMPLE_HEADS:
        by_nrp = {row["PersonnelNo"]: row for row in users}
        person = by_nrp.get(nrp)
        name = person["CompleteName"] if person else "(missing)"
        officers = officer_names_under(users, roles, nrp)
        print(f"  {nrp} {name}: {len(officers)} officers -> {', '.join(officers) or '-'}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    source_cs = (os.environ.get("SOURCE_SQL_CONNECTION") or "").strip()
    target_cs = (os.environ.get("TARGET_SQL_CONNECTION") or "").strip()
    source_conn, source_host, source_db = connect(source_cs, "SOURCE(production)")
    target_conn, target_host, target_db = connect(target_cs, "TARGET(staging)")

    if (source_host.lower(), source_db.lower()) == (target_host.lower(), target_db.lower()):
        raise SystemExit("ABORT: source and target are the same database")
    if "sqlmisis-prod" not in source_host.lower():
        raise SystemExit("ABORT: SOURCE host is not production SQL (sqlmisis-prod)")
    if "sqlmisis-prod" in target_host.lower():
        raise SystemExit("ABORT: TARGET host looks like production SQL — refusing to write")

    source_cur = source_conn.cursor()
    target_cur = target_conn.cursor()
    prod_users = fetch_users(source_cur)
    stg_users = fetch_users(target_cur)
    prod_roles_by_nrp = fetch_user_role_codes(source_cur)
    stg_roles_by_nrp = fetch_user_role_codes(target_cur)
    stg_role_ids = fetch_roles(target_cur)
    prod_role_ids = fetch_roles(source_cur)

    print_tree("BEFORE production", prod_users, prod_roles_by_nrp)
    print_tree("BEFORE staging", stg_users, stg_roles_by_nrp)

    missing_role_codes = sorted(
        {
            code
            for codes in prod_roles_by_nrp.values()
            for code in codes
            if code not in stg_role_ids
        }
    )
    if missing_role_codes:
        print("WARN staging missing role codes (those grants will be skipped): " + ", ".join(missing_role_codes))

    stg_by_nrp = {row["PersonnelNo"].lower(): row for row in stg_users if row["PersonnelNo"]}
    inserted = updated = reactivated = deactivated = 0
    now = datetime.now(timezone.utc)

    for prod in prod_users:
        nrp = prod["PersonnelNo"]
        if not nrp:
            continue
        existing = stg_by_nrp.get(nrp.lower())
        deleted_at = prod.get("DeletedAt")
        if existing is None:
            new_id = str(uuid.uuid4())
            if not args.dry_run:
                target_cur.execute(
                    """
                    INSERT INTO iam.USER_T (
                        Id, PersonnelNo, CompleteName, Email, Department, Position, Status,
                        ManagerUserId, AccessFailedCount, MustChangePassword,
                        CreatedAt, CreatedBy, UpdatedAt, UpdatedBy, DeletedAt, DeletedBy
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        NULL, 0, 0,
                        %s, %s, %s, %s, %s, %s
                    )
                    """,
                    (
                        new_id,
                        nrp[:20],
                        str(prod["CompleteName"] or "")[:200],
                        (str(prod["Email"]).strip()[:256] if prod.get("Email") else None),
                        (str(prod["Department"]).strip()[:100] if prod.get("Department") else None),
                        (str(prod["Position"]).strip()[:100] if prod.get("Position") else None),
                        str(prod["Status"] or "Active")[:32],
                        now,
                        ACTOR,
                        now,
                        ACTOR,
                        deleted_at,
                        prod.get("DeletedBy"),
                    ),
                )
            stg_by_nrp[nrp.lower()] = {
                "Id": new_id,
                "PersonnelNo": nrp,
                "CompleteName": prod["CompleteName"],
                "Status": prod["Status"],
                "DeletedAt": deleted_at,
                "ManagerUserId": None,
            }
            inserted += 1
            continue

        if not args.dry_run:
            target_cur.execute(
                """
                UPDATE iam.USER_T
                SET CompleteName = %s,
                    Email = %s,
                    Department = %s,
                    Position = %s,
                    Status = %s,
                    DeletedAt = %s,
                    DeletedBy = %s,
                    UpdatedAt = %s,
                    UpdatedBy = %s
                WHERE Id = %s
                """,
                (
                    str(prod["CompleteName"] or "")[:200],
                    (str(prod["Email"]).strip()[:256] if prod.get("Email") else None),
                    (str(prod["Department"]).strip()[:100] if prod.get("Department") else None),
                    (str(prod["Position"]).strip()[:100] if prod.get("Position") else None),
                    str(prod["Status"] or "Active")[:32],
                    deleted_at,
                    prod.get("DeletedBy"),
                    now,
                    ACTOR,
                    existing["Id"],
                ),
            )
        if existing.get("DeletedAt") is not None and deleted_at is None:
            reactivated += 1
        else:
            updated += 1
        existing["CompleteName"] = prod["CompleteName"]
        existing["Status"] = prod["Status"]
        existing["DeletedAt"] = deleted_at

    prod_nrps = {row["PersonnelNo"].lower() for row in prod_users if row["PersonnelNo"]}
    for row in list(stg_by_nrp.values()):
        if row["PersonnelNo"].lower() in prod_nrps:
            continue
        if row.get("DeletedAt") is not None or row.get("Status") != "Active":
            continue
        if not args.dry_run:
            target_cur.execute(
                """
                UPDATE iam.USER_T
                SET Status = 'Inactive', UpdatedAt = %s, UpdatedBy = %s
                WHERE Id = %s AND DeletedAt IS NULL
                """,
                (now, ACTOR, row["Id"]),
            )
        row["Status"] = "Inactive"
        deactivated += 1

    prod_id_to_nrp = {row["Id"]: row["PersonnelNo"] for row in prod_users}
    managers_set = 0
    if not args.dry_run:
        target_cur.execute("UPDATE iam.USER_T SET ManagerUserId = NULL")
        for prod in prod_users:
            mgr_id = prod.get("ManagerUserId")
            if not mgr_id:
                continue
            mgr_nrp = prod_id_to_nrp.get(mgr_id)
            child = stg_by_nrp.get(prod["PersonnelNo"].lower())
            manager = stg_by_nrp.get((mgr_nrp or "").lower()) if mgr_nrp else None
            if not child or not manager or child["Id"] == manager["Id"]:
                continue
            target_cur.execute(
                "UPDATE iam.USER_T SET ManagerUserId = %s, UpdatedAt = %s, UpdatedBy = %s WHERE Id = %s",
                (manager["Id"], now, ACTOR, child["Id"]),
            )
            child["ManagerUserId"] = manager["Id"]
            managers_set += 1

    roles_added = roles_removed = 0
    if not args.dry_run:
        for prod in prod_users:
            child = stg_by_nrp.get(prod["PersonnelNo"].lower())
            if not child:
                continue
            wanted = prod_roles_by_nrp.get(prod["PersonnelNo"], set())
            current = stg_roles_by_nrp.get(prod["PersonnelNo"], set())
            for code in current - wanted:
                role_id = stg_role_ids.get(code)
                if not role_id:
                    continue
                target_cur.execute(
                    "DELETE FROM iam.USER_ROLE_T WHERE UserId = %s AND RoleId = %s",
                    (child["Id"], role_id),
                )
                roles_removed += 1
            for code in wanted - current:
                role_id = stg_role_ids.get(code)
                if not role_id:
                    continue
                target_cur.execute(
                    "INSERT INTO iam.USER_ROLE_T (Id, UserId, RoleId, CreatedAt) VALUES (%s, %s, %s, %s)",
                    (str(uuid.uuid4()), child["Id"], role_id, now),
                )
                roles_added += 1

    print(
        ("PLANNED " if args.dry_run else "APPLIED ")
        + f"inserted={inserted} updated={updated} reactivated={reactivated} "
        + f"deactivated_staging_only={deactivated} managers_set={managers_set} "
        + f"roles_added={roles_added} roles_removed={roles_removed}"
    )
    if args.dry_run:
        print("DRY RUN — no writes")
        source_conn.close()
        target_conn.close()
        return 0

    target_conn.commit()

    stg_users_after = fetch_users(target_cur)
    stg_roles_after = fetch_user_role_codes(target_cur)
    print_tree("AFTER staging", stg_users_after, stg_roles_after)
    print_tree("AFTER production (unchanged)", prod_users, prod_roles_by_nrp)

    source_conn.close()
    target_conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
