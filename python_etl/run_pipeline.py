"""CLI entry point: runs extract, transform, features, model and load, printing progress as NDJSON.

    .venv/bin/python -m python_etl.run_pipeline --mode live --events
    .venv/bin/python -m python_etl.run_pipeline --mode snapshot

With --events every stage prints one JSON line when it starts and one when it ends,
which the Next.js Route Handler streams to the ETL Lab. The last line is the summary.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from python_etl import cleaning, database, features, model
from python_etl.ingestors import PORTAL_ENDPOINTS, extract_all

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = {
    "db": ROOT / "data" / "widlyiq.db",
    "svg": ROOT / "public" / "diagnostics" / "iqr_distribution.svg",
    "exports": ROOT / "data" / "exports",
    "snapshots": ROOT / "python_etl" / "snapshots",
}
STAGES = [
    ("extract", "[extract]"), ("verify-schema", "[verify-schema]"), ("dedupe", "[verify-schema]"),
    ("normalize-nbp", "[normalize-nbp]"), ("impute-median", "[impute-median]"), ("filter-iqr", "[filter-iqr]"),
    ("classify-tier", "[classify-tier]"), ("onehot-encode", "[onehot-encode]"), ("cooccur-matrix", "[cooccur-matrix]"),
    ("ml-ridge", "[ml-ridge]"), ("plot-mpl", "[plot-mpl]"), ("load-sqlite", "[sqlite-query]"),
]


class Reporter:
    def __init__(self, events: bool):
        self.events = events
        self.stages: list[dict] = []
        self._t0 = 0.0
        self._rows_in = 0

    def emit(self, payload: dict) -> None:
        if self.events:
            print(json.dumps(payload, ensure_ascii=False, default=str), flush=True)

    def start(self, stage: str, rows_in: int) -> None:
        self._t0, self._rows_in = time.perf_counter(), rows_in
        self.emit({"event": "stage", "status": "running", "stage": stage, "position": self._pos(stage), "rows_in": rows_in})

    def done(self, stage: str, rows_out: int, removed: int = 0, **detail) -> None:
        ms = int((time.perf_counter() - self._t0) * 1000)
        row = {"position": self._pos(stage), "stage": stage, "anchor": dict(STAGES)[stage], "rows_in": self._rows_in,
               "rows_out": rows_out, "removed": removed, "duration_ms": ms, "detail": detail}
        self.stages.append(row)
        self.emit({"event": "stage", "status": "done", **row})

    @staticmethod
    def _pos(stage: str) -> int:
        return [s for s, _ in STAGES].index(stage) + 1


def run(mode: str, paths: dict[str, Path], reporter: Reporter) -> dict:
    started = datetime.now(timezone.utc)
    run_id = "run-" + started.strftime("%Y%m%dT%H%M%SZ")
    reporter.emit({"event": "run", "status": "started", "run_id": run_id, "mode": mode, "stages": [s for s, _ in STAGES]})

    reporter.start("extract", 0)
    sources = extract_all(paths["snapshots"], mode)
    for name, res in sources.items():
        reporter.emit({"event": "source", "source": name, "mode": res.mode, "reason": res.fallback_reason,
                       "records": res.log_row()["records"], "duration_ms": res.duration_ms})
    raw_records = []
    for portal in PORTAL_ENDPOINTS:
        res = sources[portal]
        synthetic = res.mode == "snapshot" and res.meta.get("synthetic", False)
        raw_records += [{**r, "source_mode": res.mode, "is_synthetic": int(synthetic)} for r in res.records]
    reporter.done("extract", len(raw_records), sources={k: v.mode for k, v in sources.items()})

    reporter.start("verify-schema", len(raw_records))
    harmonized = cleaning.harmonize(raw_records)
    raw_frame = harmonized.copy()
    df, rejected_schema = cleaning.verify_schema(harmonized, set(sources["nbp"].records["rates"]))
    reporter.done("verify-schema", len(df), len(rejected_schema),
                  reasons=rejected_schema["reason"].value_counts().to_dict())

    reporter.start("dedupe", len(df))
    df, rejected_dup = cleaning.deduplicate(df)
    reporter.done("dedupe", len(df), len(rejected_dup))

    reporter.start("normalize-nbp", len(df))
    df = cleaning.normalize_currency(df, sources["nbp"].records)
    converted = int(((df["currency"].fillna("PLN") != "PLN") & df["salary_to"].notna()).sum())
    hourly = int(((df["period"] == "hour") & df["salary_to"].notna()).sum())
    reporter.done("normalize-nbp", len(df), 0, converted=converted, hourly=hourly, table=sources["nbp"].records["table_no"])

    reporter.start("impute-median", len(df))
    before = len(df)
    df = cleaning.impute_median(df)
    reporter.done("impute-median", len(df), before - len(df), imputed=int(df["is_imputed"].sum()))

    reporter.start("filter-iqr", len(df))
    df, rejected_iqr = cleaning.filter_outliers(df)
    reporter.done("filter-iqr", len(df), len(rejected_iqr), reasons=rejected_iqr["reason"].value_counts().to_dict())

    reporter.start("classify-tier", len(df))
    gus = sources["gus"].records
    clean = cleaning.classify(df, gus)
    reporter.done("classify-tier", len(clean), 0, tiers=clean["tier"].value_counts().to_dict())

    reporter.start("onehot-encode", len(clean))
    clean = clean.reset_index(drop=True)
    fs = features.build_features(clean)
    reporter.done("onehot-encode", len(clean), 0, columns=len(fs.columns), skills=len(fs.skills))

    reporter.start("cooccur-matrix", len(clean))
    cooccur = features.cooccurrence(fs, clean["salary_pln_month"].to_numpy(dtype=float))
    stats = features.skill_stats(clean, fs.skills)
    order, clusters = features.heatmap_order(cooccur, fs.skills)
    stats["heatmap_order"] = stats["skill"].map(order)
    stats["heatmap_cluster"] = stats["skill"].map(clusters)
    # A cluster is named after the job category its skills appear in most, so the heatmap blocks read as "Data", "Frontend".
    pairs = clean[["category", "skills"]].explode("skills")
    pairs["cluster"] = pairs["skills"].map(clusters)
    dominant = pairs.dropna(subset=["cluster"]).groupby("cluster")["category"].agg(lambda c: c.value_counts().index[0])
    stats["heatmap_cluster_label"] = stats["heatmap_cluster"].map(dominant)
    reporter.done("cooccur-matrix", len(clean), 0, pairs=len(cooccur), shape=[len(fs.skills), len(fs.skills)])

    reporter.start("ml-ridge", len(clean))
    weights, metrics = model.train_ridge(fs)
    bias = model.portal_bias(fs, metrics["alpha"])
    truth = model.ground_truth_check(weights, paths["snapshots"] / "ground_truth.json") \
        if all(sources[p].mode == "snapshot" for p in PORTAL_ENDPOINTS) else None
    if truth:
        metrics["ground_truth"] = truth
    stats = stats.merge(weights[weights["feature_group"] == "skill"][["label", "weight"]].rename(
        columns={"label": "skill", "weight": "ridge_weight"}), on="skill", how="left")
    reporter.done("ml-ridge", len(clean), 0, **metrics)

    rejected = pd.concat([rejected_schema, rejected_dup, rejected_iqr], ignore_index=True)
    reporter.start("plot-mpl", len(clean))
    model.plot_iqr_distribution(clean, rejected, paths["svg"])
    reporter.done("plot-mpl", len(clean), 0, path=str(paths["svg"].relative_to(ROOT)) if paths["svg"].is_relative_to(ROOT) else str(paths["svg"]))

    reporter.start("load-sqlite", len(clean))
    gus_out = gus.assign(source_mode=sources["gus"].mode)
    tables = database.build_tables(raw_frame, clean, rejected, fs.matrix, cooccur, stats, gus_out, weights, bias)
    exports = database.write_exports(fs.matrix, paths["exports"], run_id)
    finished = datetime.now(timezone.utc)
    counts = {
        "raw": len(raw_records), "schema_rejected": len(rejected_schema), "duplicates": len(rejected_dup),
        "imputed": int(clean["is_imputed"].sum()), "outliers": len(rejected_iqr), "clean": len(clean),
        "by_source": {p: sources[p].log_row()["records"] for p in PORTAL_ENDPOINTS},
    }
    run_row = {"run_id": run_id, "started_at": started.isoformat(timespec="seconds"),
               "finished_at": finished.isoformat(timespec="seconds"),
               "duration_ms": int((finished - started).total_seconds() * 1000), "mode": mode, "status": "ok",
               "counts": counts, "metrics": {**metrics, "nbp_table": sources["nbp"].records["table_no"],
                                             "nbp_date": sources["nbp"].records["effective_date"],
                                             "gus_year": int(gus["year"].max()), "exports": list(exports)}}
    con = database.connect(paths["db"])
    try:
        # The load stage's own row is recorded before the write so it lands in the same transaction.
        reporter.done("load-sqlite", len(clean), 0, tables=len(tables))
        database.write_run(con, run_row, [s.log_row() for s in sources.values()], reporter.stages, tables)
    finally:
        con.close()
    summary = {"event": "summary", **run_row, "sources": {k: {"mode": v.mode, "reason": v.fallback_reason}
                                                         for k, v in sources.items()}}
    reporter.emit(summary)
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="WidlyIQ ETL pipeline")
    parser.add_argument("--mode", choices=["live", "snapshot"], default="live",
                        help="live: try every source online, fall back to snapshots per source; snapshot: offline only")
    parser.add_argument("--events", action="store_true", help="print NDJSON progress events")
    for key, value in DEFAULTS.items():
        parser.add_argument(f"--{key}", type=Path, default=value)
    args = parser.parse_args(argv)
    paths = {k: getattr(args, k) for k in DEFAULTS}
    reporter = Reporter(args.events)
    try:
        summary = run(args.mode, paths, reporter)
    except Exception as exc:  # noqa: BLE001 - the caller needs a structured error, not a bare traceback
        stage = reporter.stages[-1]["stage"] if reporter.stages else "extract"
        print(json.dumps({"event": "error", "after_stage": stage, "message": f"{type(exc).__name__}: {exc}"},
                         ensure_ascii=False), flush=True)
        traceback.print_exc(file=sys.stderr)
        return 1
    if not args.events:
        print(json.dumps({k: summary[k] for k in ("run_id", "mode", "duration_ms", "counts", "metrics")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
