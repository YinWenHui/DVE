"""Deterministic source normalization and safe field-key generation."""
from __future__ import annotations

import re
import unicodedata
from typing import Mapping

import pandas as pd


def safe_field_key(value: str, used: set[str]) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    key = re.sub(r"[^A-Za-z0-9]+", "_", normalized).strip("_") or "Field"
    if not key[0].isalpha():
        key = f"Field_{key}"
    base = key
    suffix = 2
    while key.lower() in used:
        key = f"{base}_{suffix}"
        suffix += 1
    used.add(key.lower())
    return key


def normalize_columns(frame: pd.DataFrame) -> tuple[pd.DataFrame, Mapping[str, str]]:
    used: set[str] = set()
    mapping = {str(column): safe_field_key(str(column), used) for column in frame.columns}
    return frame.rename(columns=mapping), mapping


def apply_declared_types(frame: pd.DataFrame, declared_types: Mapping[str, str]) -> pd.DataFrame:
    converted = frame.copy()
    for field, data_type in declared_types.items():
        if field not in converted.columns:
            continue
        if data_type in {"integer", "decimal"}:
            converted[field] = pd.to_numeric(converted[field], errors="raise")
            if data_type == "integer":
                converted[field] = converted[field].astype("Int64")
        elif data_type == "boolean":
            converted[field] = converted[field].map({True: True, False: False, "true": True, "false": False, "1": True, "0": False})
        elif data_type in {"date", "datetime"}:
            converted[field] = pd.to_datetime(converted[field], errors="raise", utc=True)
        else:
            converted[field] = converted[field].astype("string")
    return converted
