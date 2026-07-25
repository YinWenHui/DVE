"""Transactional, versioned SQL Server writer for imported single-table datasets."""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Mapping

import pandas as pd
import pyodbc


IDENTIFIER = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,127}$")
SQL_TYPES = {"string": "nvarchar(4000)", "integer": "bigint", "decimal": "decimal(28, 8)", "boolean": "bit", "date": "date", "datetime": "datetime2(3)"}


def quote_identifier(value: str) -> str:
    if not IDENTIFIER.fullmatch(value):
        raise ValueError(f"Unsafe SQL identifier rejected: {value}")
    return f"[{value}]"


def schema_hash(fields: Mapping[str, str]) -> str:
    canonical = json.dumps(sorted(fields.items()), separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def write_version(connection_string: str, dataset_id: str, frame: pd.DataFrame, field_types: Mapping[str, str], batch_size: int = 1000) -> dict[str, object]:
    dataset_key = uuid.UUID(dataset_id).hex
    batch_id = uuid.uuid4()
    version_id = uuid.uuid4()
    physical_name = f"dataset_{dataset_key}_{batch_id.hex[:12]}"
    columns = list(field_types)
    if set(columns) != set(frame.columns):
        raise ValueError("Frame fields must exactly match registered field metadata.")
    column_sql = ", ".join(f"{quote_identifier(name)} {SQL_TYPES[field_types[name]]} NULL" for name in columns)
    table = f"[dve_data].{quote_identifier(physical_name)}"
    connection = pyodbc.connect(connection_string, autocommit=False)
    try:
        cursor = connection.cursor()
        cursor.execute(f"CREATE TABLE {table} ([__row_id] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY, [__import_batch_id] uniqueidentifier NOT NULL, [__imported_at] datetime2(3) NOT NULL, [__source_row_number] bigint NOT NULL, {column_sql})")
        placeholders = ", ".join("?" for _ in range(len(columns) + 3))
        insert_sql = f"INSERT INTO {table} ([__import_batch_id], [__imported_at], [__source_row_number], {', '.join(quote_identifier(name) for name in columns)}) VALUES ({placeholders})"
        imported_at = datetime.now(timezone.utc).replace(tzinfo=None)
        rows = []
        for source_row, values in enumerate(frame.itertuples(index=False, name=None), start=2):
            normalized = [None if pd.isna(value) else value.to_pydatetime().replace(tzinfo=None) if isinstance(value, pd.Timestamp) else value.item() if hasattr(value, "item") else value for value in values]
            rows.append((str(batch_id), imported_at, source_row, *normalized))
        cursor.fast_executemany = True
        for offset in range(0, len(rows), batch_size):
            cursor.executemany(insert_sql, rows[offset:offset + batch_size])
        actual_count = cursor.execute(f"SELECT COUNT_BIG(*) FROM {table}").fetchone()[0]
        if actual_count != len(frame.index):
            raise ValueError("Imported row-count validation failed.")
        cursor.execute("SELECT ISNULL(MAX(version_number), 0) + 1 FROM dve.dataset_versions WITH (UPDLOCK, HOLDLOCK) WHERE dataset_id = ?", dataset_id)
        version_number = cursor.fetchone()[0]
        cursor.execute("UPDATE dve.dataset_versions SET is_active = 0 WHERE dataset_id = ? AND is_active = 1", dataset_id)
        cursor.execute("INSERT INTO dve.dataset_versions (version_id, dataset_id, version_number, schema_hash, row_count, physical_object_name, imported_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)", str(version_id), dataset_id, version_number, schema_hash(field_types), actual_count, physical_name, imported_at)
        cursor.execute("UPDATE dve.datasets SET physical_schema = 'dve_data', physical_object_name = ?, status = 'healthy', updated_at = SYSUTCDATETIME() WHERE dataset_id = ?", physical_name, dataset_id)
        connection.commit()
        return {"dataset_id": dataset_id, "version_id": str(version_id), "batch_id": str(batch_id), "row_count": actual_count, "physical_object_name": physical_name, "schema_hash": schema_hash(field_types)}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
