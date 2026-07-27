"""CLI adapter that validates and imports one Excel/CSV source version."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd
from charset_normalizer import from_path

from logging_config import configure_logging
from sql_writer import write_version
from transformers import apply_declared_types, normalize_columns
from validators import validate_file, validate_required_fields, validate_row_limit


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--file", required=True, type=Path)
    parser.add_argument("--sheet")
    parser.add_argument("--header-row", type=int, default=1)
    parser.add_argument("--field-types", required=True, help="JSON object of safe field key to Digital Verse data type")
    parser.add_argument("--required-fields", default="[]", help="JSON array of safe field keys")
    parser.add_argument("--maximum-mb", type=int, default=25)
    parser.add_argument("--maximum-rows", type=int, default=500000)
    return parser.parse_args()


def read_source(path: Path, sheet: str | None, header_row: int) -> pd.DataFrame:
    if path.suffix.lower() == ".xlsx":
        return pd.read_excel(path, sheet_name=sheet or 0, header=header_row - 1, engine="openpyxl")
    detected = from_path(path).best()
    encoding = detected.encoding if detected else "utf-8"
    return pd.read_csv(path, header=header_row - 1, encoding=encoding)


def main() -> int:
    configure_logging()
    args = arguments()
    try:
        validate_file(args.file, args.maximum_mb * 1024 * 1024)
        frame, mapping = normalize_columns(read_source(args.file, args.sheet, args.header_row))
        field_types = json.loads(args.field_types)
        validate_required_fields(frame, json.loads(args.required_fields))
        validate_row_limit(frame, args.maximum_rows)
        frame = apply_declared_types(frame[list(field_types)], field_types)
        connection_string = os.environ.get("DVE_SQL_CONNECTION_STRING")
        if not connection_string:
            raise ValueError("DVE_SQL_CONNECTION_STRING is required.")
        result = write_version(connection_string, args.dataset_id, frame, field_types)
        print(json.dumps({"ok": True, "source_columns": mapping, **result}, default=str))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": {"code": "ETL_FAILED", "message": str(exc)}}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
