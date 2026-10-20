from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from python_etl import cleaning, features
from python_etl.ingestors import parse_nbp_xml, read_gus_xlsx

SNAPSHOTS = Path(__file__).resolve().parents[1] / "snapshots"
NBP = {"table_no": "204/A/NBP/2026", "rates": {"PLN": 1.0, "EUR": 4.3716}}


def raw(**overrides) -> dict:
    base = {"source": "nofluffjobs", "source_id": "1", "title": "Mid Backend Developer", "company": "Kodwerk",
            "category_raw": "backend", "seniority_raw": "Mid", "contract_raw": "b2b", "salary_from": 16000,
            "salary_to": 20000, "currency": "PLN", "period_raw": "Month", "city": "Rzeszów", "region_raw": None,
            "remote": False, "skills_raw": ["Python"], "published_at": "2026-10-10", "raw_json": "{}"}
    return {**base, **overrides}


def run_until_currency(records: list[dict]) -> pd.DataFrame:
    df = cleaning.harmonize(records)
    df, _ = cleaning.verify_schema(df, set(NBP["rates"]))
    return cleaning.normalize_currency(df, NBP)


def test_hourly_rate_becomes_monthly_with_168_hours():
    df = run_until_currency([raw(salary_from=100, salary_to=120, period_raw="Hour")])
    assert df.loc[0, "salary_pln_month"] == pytest.approx(110 * 168)


def test_foreign_currency_uses_nbp_mid_rate():
    df = run_until_currency([raw(salary_from=4000, salary_to=5000, currency="EUR")])
    assert df.loc[0, "salary_pln_month"] == pytest.approx(round(4500 * 4.3716))
    assert any("EUR" in note for note in df.loc[0, "transform_log"])


def test_schema_repairs_thousands_and_swapped_range():
    df = run_until_currency([raw(salary_from=21.5, salary_to=18.5)])
    assert (df.loc[0, "salary_from"], df.loc[0, "salary_to"]) == (18500, 21500)


def test_schema_rejects_negative_salary_and_unknown_currency():
    df = cleaning.harmonize([raw(source_id="a", salary_from=-1), raw(source_id="b", currency="XYZ"), raw(source_id="c")])
    kept, rejected = cleaning.verify_schema(df, set(NBP["rates"]))
    assert list(kept["source_id"]) == ["c"]
    assert set(rejected["reason"]) == {"ujemne wynagrodzenie", "nieznana waluta"}


def test_cross_portal_duplicate_keeps_copy_with_salary():
    df = cleaning.harmonize([raw(source="justjoinit", salary_from=None, salary_to=None), raw(source="solidjobs")])
    df, _ = cleaning.verify_schema(df, set(NBP["rates"]))
    kept, rejected = cleaning.deduplicate(df)
    assert list(kept["source"]) == ["solidjobs"]
    assert len(rejected) == 1


def test_missing_salary_is_imputed_with_group_median_and_flagged():
    records = [raw(source_id=str(i), salary_from=s, salary_to=s, title=f"Mid Backend Developer {i}")
               for i, s in enumerate([15000, 16000, 17000, 18000, 19000])]
    records.append(raw(source_id="gap", salary_from=None, salary_to=None, title="Mid Backend Developer gap"))
    df = cleaning.impute_median(run_until_currency(records))
    gap = df[df["source_id"] == "gap"].iloc[0]
    assert gap["is_imputed"] == 1
    assert gap["salary_pln_month"] == 17000


def test_iqr_rejects_extreme_salary_but_keeps_the_group():
    rng = np.random.default_rng(1)
    salaries = list(rng.normal(18000, 1500, 30).round(-2)) + [180000]
    records = [raw(source_id=str(i), salary_from=s, salary_to=s, title=f"Mid Backend Developer {i}") for i, s in enumerate(salaries)]
    df = cleaning.impute_median(run_until_currency(records))
    kept, rejected = cleaning.filter_outliers(df)
    assert 180000 in set(rejected["salary_pln_month"])
    # A 30-row normal sample can push one or two genuine tail values past k = 1.5; the group must survive.
    assert len(kept) >= 28


def test_cooccurrence_diagonal_equals_skill_demand():
    df = pd.DataFrame({"offer_id": [f"o{i}" for i in range(10)], "source": "nofluffjobs",
                       "skills": [["Python", "SQL"]] * 9 + [["Python"]], "salary_pln_month": 20000.0, "is_imputed": 0,
                       "seniority": "mid", "category": "data", "contract": "b2b", "region": "podkarpackie",
                       "gus_wage": 8195.62, "seniority_rank": 1})
    old_min = features.MIN_SKILL_COUNT
    features.MIN_SKILL_COUNT = 1
    try:
        fs = features.build_features(df)
    finally:
        features.MIN_SKILL_COUNT = old_min
    pairs = features.cooccurrence(fs, df["salary_pln_month"].to_numpy())
    diag = pairs[pairs["skill_a"] == pairs["skill_b"]].set_index("skill_a")["count"]
    assert diag.to_dict() == {"Python": 10, "SQL": 9}
    off = pairs[(pairs["skill_a"] == "Python") & (pairs["skill_b"] == "SQL")].iloc[0]
    assert off["count"] == 9


def test_snapshot_sources_parse():
    table = parse_nbp_xml((SNAPSHOTS / "nbp_table_a.xml").read_text(encoding="utf-8"))
    assert table["rates"]["PLN"] == 1.0 and "EUR" in table["rates"]
    gus = read_gus_xlsx(SNAPSHOTS / "gus_bdl_wages.xlsx")
    latest = gus[gus["year"] == gus["year"].max()]
    assert len(latest) == 17
    assert "podkarpackie" in set(latest["region"])
