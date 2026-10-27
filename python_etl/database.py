"""Load stage: writes every analytical table to data/widlyiq.db and generates the feature-matrix exports."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd

SCHEMA = """
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id TEXT PRIMARY KEY, started_at TEXT, finished_at TEXT, duration_ms INTEGER, mode TEXT,
    status TEXT, counts TEXT, metrics TEXT
);
CREATE TABLE IF NOT EXISTS raw_ingestion_logs (
    run_id TEXT, source TEXT, mode TEXT, url TEXT, http_status INTEGER, fallback_reason TEXT,
    records INTEGER, bytes INTEGER, duration_ms INTEGER, fetched_at TEXT, meta TEXT
);
CREATE TABLE IF NOT EXISTS pipeline_stages (
    run_id TEXT, position INTEGER, stage TEXT, anchor TEXT, rows_in INTEGER, rows_out INTEGER,
    removed INTEGER, duration_ms INTEGER, detail TEXT
);
"""
# Tables rebuilt on every run; history lives in pipeline_runs, raw_ingestion_logs and pipeline_stages.
SNAPSHOT_TABLES = ["offers_raw", "offers_clean", "offer_skills", "ai_feature_matrix", "rejected_outliers",
                   "skill_cooccurrence", "skill_stats", "gus_benchmarks", "ml_feature_weights", "portal_bias"]
INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_clean_filter ON offers_clean(region, seniority, category, contract)",
    "CREATE INDEX IF NOT EXISTS ix_clean_offer ON offers_clean(offer_id)",
    "CREATE INDEX IF NOT EXISTS ix_raw_offer ON offers_raw(offer_id)",
    "CREATE INDEX IF NOT EXISTS ix_skills_offer ON offer_skills(offer_id)",
    "CREATE INDEX IF NOT EXISTS ix_skills_skill ON offer_skills(skill)",
    "CREATE INDEX IF NOT EXISTS ix_rejected_offer ON rejected_outliers(offer_id)",
]
CLEAN_COLUMNS = ["offer_id", "source", "source_mode", "is_synthetic", "title", "company", "category", "seniority",
                 "seniority_rank", "contract", "city", "region", "currency", "period", "fx_rate", "fx_table",
                 "salary_from_pln", "salary_to_pln", "salary_pln_month", "is_imputed", "imputation_group",
                 "lower_fence", "upper_fence", "z_score", "gus_year", "gus_wage", "gus_multiple", "tier", "cv_residual",
                 "published_at", "transform_log"]
RAW_COLUMNS = ["offer_id", "source", "source_mode", "title", "company", "category_raw", "seniority_raw",
               "contract_raw", "salary_from", "salary_to", "currency", "period_raw", "city", "region_raw",
               "skills_raw", "published_at", "raw_json"]
REJECTED_COLUMNS = ["offer_id", "source", "stage", "reason", "title", "seniority", "category", "contract", "region",
                    "salary_pln_month", "lower_fence", "upper_fence", "z_score", "group_key"]


def _jsonify(frame: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    frame = frame.copy()
    for c in cols:
        if c in frame:
            frame[c] = frame[c].map(lambda v: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v)
    return frame


def _sql_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series) or pd.api.types.is_integer_dtype(series):
        return "INTEGER"
    if pd.api.types.is_float_dtype(series):
        return "REAL"
    return "TEXT"


def _write_frame(con: sqlite3.Connection, name: str, frame: pd.DataFrame) -> None:
    """Hand-rolled instead of DataFrame.to_sql, which commits on its own and would split the run's transaction."""
    cols = ", ".join(f'"{c}" {_sql_type(frame[c])}' for c in frame.columns)
    con.execute(f'CREATE TABLE "{name}" ({cols})')
    placeholders = ", ".join("?" for _ in frame.columns)
    clean = frame.astype(object).where(frame.notna(), None)
    rows = [tuple(v.item() if hasattr(v, "item") else v for v in row) for row in clean.itertuples(index=False, name=None)]
    con.executemany(f'INSERT INTO "{name}" VALUES ({placeholders})', rows)


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path, isolation_level=None)
    # WAL lets the dashboard keep reading the previous run while this one commits.
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript(SCHEMA)
    return con


def write_run(con: sqlite3.Connection, run: dict, logs: list[dict], stages: list[dict], tables: dict[str, pd.DataFrame]) -> None:
    """One transaction for the whole run, so readers see either the old tables or the new ones, never a mix."""
    con.execute("BEGIN IMMEDIATE")
    try:
        for name in SNAPSHOT_TABLES:
            con.execute(f'DROP TABLE IF EXISTS "{name}"')
        for name, frame in tables.items():
            _write_frame(con, name, _jsonify(frame, ["transform_log", "skills_raw", "skills", "detail"]))
        for stmt in INDEXES:
            con.execute(stmt)
        con.execute("INSERT OR REPLACE INTO pipeline_runs VALUES (?,?,?,?,?,?,?,?)", (
            run["run_id"], run["started_at"], run["finished_at"], run["duration_ms"], run["mode"], run["status"],
            json.dumps(run["counts"], ensure_ascii=False), json.dumps(run["metrics"], ensure_ascii=False)))
        con.executemany("INSERT INTO raw_ingestion_logs VALUES (:run_id,:source,:mode,:url,:http_status,:fallback_reason,"
                        ":records,:bytes,:duration_ms,:fetched_at,:meta)", [{**row, "run_id": run["run_id"]} for row in logs])
        con.executemany("INSERT INTO pipeline_stages VALUES (:run_id,:position,:stage,:anchor,:rows_in,:rows_out,:removed,"
                        ":duration_ms,:detail)", [{**s, "run_id": run["run_id"],
                                                   "detail": json.dumps(s.get("detail", {}), ensure_ascii=False)} for s in stages])
        con.execute("COMMIT")
    except Exception:
        con.execute("ROLLBACK")
        raise
    # Dropped tables leave their pages on the freelist: without VACUUM the file grows with every run and keeps old rows.
    try:
        con.execute("VACUUM")
    except sqlite3.OperationalError:
        pass  # a reader holding a transaction blocks VACUUM; the next run reclaims the space


def build_tables(raw: pd.DataFrame, clean: pd.DataFrame, rejected: pd.DataFrame, features: pd.DataFrame,
                 cooccur: pd.DataFrame, stats: pd.DataFrame, gus: pd.DataFrame, weights: pd.DataFrame,
                 bias: pd.DataFrame) -> dict[str, pd.DataFrame]:
    skills = clean[["offer_id", "skills"]].explode("skills").dropna().rename(columns={"skills": "skill"})
    return {
        "offers_raw": raw[RAW_COLUMNS],
        "offers_clean": clean[CLEAN_COLUMNS],
        "offer_skills": skills,
        "ai_feature_matrix": features,
        "rejected_outliers": rejected.reindex(columns=REJECTED_COLUMNS),
        "skill_cooccurrence": cooccur,
        "skill_stats": stats,
        "gus_benchmarks": gus,
        "ml_feature_weights": weights,
        "portal_bias": bias,
    }


def write_exports(features: pd.DataFrame, export_dir: Path, run_id: str) -> dict[str, str]:
    """Pre-renders the feature matrix so the export route only streams a file, with no Python on the request path."""
    export_dir.mkdir(parents=True, exist_ok=True)
    paths = {"csv": export_dir / "feature_matrix.csv", "json": export_dir / "feature_matrix.json",
             "xlsx": export_dir / "feature_matrix.xlsx"}
    features.to_csv(paths["csv"], index=False, encoding="utf-8")
    paths["json"].write_text(json.dumps({"run_id": run_id, "columns": list(features.columns),
                                         "rows": features.to_dict(orient="records")}, ensure_ascii=False), encoding="utf-8")
    with pd.ExcelWriter(paths["xlsx"], engine="openpyxl") as writer:
        features.to_excel(writer, sheet_name="feature_matrix", index=False)
        pd.DataFrame({"column": features.columns}).to_excel(writer, sheet_name="columns", index=False)
    return {k: str(v) for k, v in paths.items()}
