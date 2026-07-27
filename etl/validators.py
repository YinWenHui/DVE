"""Input and schema validation shared by file refresh adapters."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

import pandas as pd


SUPPORTED_SUFFIXES = {".csv", ".xlsx"}


def validate_file(path: Path, maximum_bytes: int) -> None:
    if not path.is_file():
        raise ValueError("Source file does not exist or is not a regular file.")
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError("Only .csv and .xlsx files are supported.")
    if path.stat().st_size > maximum_bytes:
        raise ValueError(f"Source file exceeds the {maximum_bytes} byte limit.")


def validate_required_fields(frame: pd.DataFrame, required_fields: Iterable[str]) -> None:
    missing = sorted(set(required_fields) - set(frame.columns))
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    if frame.columns.duplicated().any():
        duplicates = frame.columns[frame.columns.duplicated()].tolist()
        raise ValueError(f"Duplicate fields are not permitted: {', '.join(duplicates)}")


def validate_row_limit(frame: pd.DataFrame, maximum_rows: int) -> None:
    if len(frame.index) > maximum_rows:
        raise ValueError(f"Source contains {len(frame.index)} rows; limit is {maximum_rows}.")
