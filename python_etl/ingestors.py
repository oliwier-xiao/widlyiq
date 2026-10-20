"""Extract stage: portal offers, NBP exchange rates and GUS regional wages, each with snapshot fallback.

Every source returns a SourceResult that records where the data actually came from,
so provenance (live or snapshot, and why) survives into raw_ingestion_logs and the UI.
"""

from __future__ import annotations

import io
import json
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import pandas as pd
import requests

USER_AGENT = "WidlyIQ/0.1 (university data-analysis project; contact via repository)"
LIVE_TIMEOUT_S = 12
PORTAL_LIVE_TIMEOUT_S = 90
MAX_LIVE_BYTES = 250 * 1024 * 1024

PORTAL_ENDPOINTS = {
    "nofluffjobs": "https://nofluffjobs.com/api/posting",
    "justjoinit": "https://api.justjoin.it/v2/user-panel/offers?page=1&perPage=100&sortBy=published&orderBy=DESC",
    "solidjobs": "https://solid.jobs/api/offers",
}
NBP_URL = "https://api.nbp.pl/api/exchangerates/tables/A/?format=xml"
BDL_URL = "https://bdl.stat.gov.pl/api/v1/data/by-variable/64428"
BDL_WAGE_VARIABLE = 64428


class SourceUnavailable(Exception):
    """Raised for any reason a live source cannot be used; the message becomes the fallback reason."""


@dataclass
class SourceResult:
    source: str
    mode: str
    url: str
    records: Any
    http_status: int | None = None
    fallback_reason: str | None = None
    bytes: int = 0
    duration_ms: int = 0
    fetched_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds"))
    meta: dict = field(default_factory=dict)

    def log_row(self) -> dict:
        if isinstance(self.records, dict) and "rates" in self.records:
            count = len(self.records["rates"])
        else:
            count = len(self.records) if hasattr(self.records, "__len__") else None
        return {
            "source": self.source, "mode": self.mode, "url": self.url, "http_status": self.http_status,
            "fallback_reason": self.fallback_reason, "records": count, "bytes": self.bytes,
            "duration_ms": self.duration_ms, "fetched_at": self.fetched_at, "meta": json.dumps(self.meta, ensure_ascii=False),
        }


def _http_get(url: str, timeout: float, params: dict | None = None) -> tuple[bytes, int]:
    try:
        with requests.get(url, params=params, headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/xml"},
                          timeout=timeout, stream=True) as r:
            # 403 and 429 are the portals' way of saying no; they must never crash the run.
            if r.status_code in (403, 429):
                raise SourceUnavailable(f"HTTP {r.status_code}: blokada lub limit zapytań")
            if r.status_code >= 400:
                raise SourceUnavailable(f"HTTP {r.status_code}")
            chunks, size = [], 0
            for chunk in r.iter_content(chunk_size=1 << 16):
                size += len(chunk)
                if size > MAX_LIVE_BYTES:
                    raise SourceUnavailable(f"odpowiedź większa niż {MAX_LIVE_BYTES // 2**20} MB")
                chunks.append(chunk)
            return b"".join(chunks), r.status_code
    except requests.Timeout as exc:
        raise SourceUnavailable(f"przekroczony czas {timeout:.0f} s") from exc
    except requests.ConnectionError as exc:
        raise SourceUnavailable("brak połączenia z siecią") from exc
    except requests.RequestException as exc:
        raise SourceUnavailable(type(exc).__name__) from exc


def _with_fallback(source: str, url: str, live: Callable[[], tuple[Any, int, int, dict]],
                   snapshot: Callable[[], tuple[Any, dict]], try_live: bool) -> SourceResult:
    # [extract] live first when asked, snapshot on any failure, with the reason kept for the log
    start = time.perf_counter()
    reason = None
    if try_live:
        try:
            records, status, size, meta = live()
            return SourceResult(source, "live", url, records, status, None, size,
                                int((time.perf_counter() - start) * 1000), meta=meta)
        except SourceUnavailable as exc:
            reason = str(exc)
    records, meta = snapshot()
    return SourceResult(source, "snapshot", url, records, None, reason if try_live else "tryb snapshot",
                        0, int((time.perf_counter() - start) * 1000), meta=meta)


# Portal adapters: each maps its native schema onto the same raw record shape.

def _raw(source: str, source_id, title, company, category, seniority, contract, salary_from, salary_to,
         currency, period, city, region, remote, skills, published, native: dict) -> dict:
    return {
        "source": source, "source_id": str(source_id), "title": title, "company": company,
        "category_raw": category, "seniority_raw": seniority, "contract_raw": contract,
        "salary_from": salary_from, "salary_to": salary_to, "currency": currency, "period_raw": period,
        "city": city, "region_raw": region, "remote": remote, "skills_raw": list(skills or []),
        "published_at": published, "raw_json": json.dumps(native, ensure_ascii=False, default=str),
    }


def parse_nofluffjobs(payload: dict) -> list[dict]:
    out = []
    for p in payload.get("postings", []):
        places = (p.get("location") or {}).get("places") or []
        city = next((pl.get("city") for pl in places if pl.get("city")), None)
        salary = p.get("salary") or {}
        skills = [t.get("value") for t in (p.get("tiles") or {}).get("values", []) if t.get("type") == "requirement"]
        if not skills and p.get("technology"):
            skills = [p["technology"]]
        posted = p.get("posted")
        published = datetime.fromtimestamp(posted / 1000, tz=timezone.utc).isoformat() if posted else None
        out.append(_raw("nofluffjobs", p.get("id"), p.get("title"), p.get("name"), p.get("category"),
                        (p.get("seniority") or [None])[0], salary.get("type"), salary.get("from"), salary.get("to"),
                        salary.get("currency"), salary.get("period"), city, None,
                        bool(p.get("fullyRemote") or (p.get("location") or {}).get("fullyRemote")), skills, published, p))
    return out


JJIT_CATEGORY = {1: "frontend", 2: "backend", 3: "fullstack", 4: "mobile", 6: "data", 7: "devops", 9: "testing",
                 11: "security", 25: "ai"}


def parse_justjoinit(payload: dict) -> list[dict]:
    out = []
    for o in payload.get("data", []):
        employment = (o.get("employmentTypes") or [{}])[0] or {}
        city = o.get("city") if o.get("city") not in (None, "Remote") else None
        category = JJIT_CATEGORY.get(o.get("categoryId")) if o.get("categoryId") is not None else None
        currency = (employment.get("currency") or "").upper() or None
        out.append(_raw("justjoinit", o.get("slug"), o.get("title"), o.get("companyName"), category,
                        o.get("experienceLevel"), employment.get("type"), employment.get("from"), employment.get("to"),
                        currency, employment.get("unit"), city, None, o.get("workplaceType") == "remote",
                        o.get("requiredSkills"), o.get("publishedAt"), o))
    return out


def parse_solidjobs(payload: dict) -> list[dict]:
    out = []
    for o in payload.get("offers", []):
        s = o.get("salaryRange") or {}
        skills = [k.get("name") for k in o.get("requiredSkills") or []]
        out.append(_raw("solidjobs", o.get("id"), o.get("jobTitle"), o.get("companyName"), o.get("category"),
                        o.get("experienceLevel"), s.get("contractType"), s.get("lowerBound"), s.get("upperBound"),
                        s.get("currency"), s.get("period"), o.get("city"), o.get("region"), o.get("remotePossible"),
                        skills, o.get("publishedOn"), o))
    return out


PORTAL_PARSERS = {"nofluffjobs": parse_nofluffjobs, "justjoinit": parse_justjoinit, "solidjobs": parse_solidjobs}


def extract_portal(source: str, snapshot_dir: Path, try_live: bool) -> SourceResult:
    url = PORTAL_ENDPOINTS[source]
    parser = PORTAL_PARSERS[source]

    def live():
        body, status = _http_get(url, PORTAL_LIVE_TIMEOUT_S)
        try:
            records = parser(json.loads(body))
        except (ValueError, AttributeError, TypeError) as exc:
            raise SourceUnavailable(f"nieznany format odpowiedzi ({type(exc).__name__})") from exc
        if not records:
            raise SourceUnavailable("pusta odpowiedź")
        return records, status, len(body), {"synthetic": False}

    def snapshot():
        payload = json.loads((snapshot_dir / f"{source}.json").read_text(encoding="utf-8"))
        return parser(payload), {"synthetic": bool(payload.get("synthetic") or (payload.get("meta") or {}).get("synthetic"))}

    return _with_fallback(source, url, live, snapshot, try_live)


def parse_nbp_xml(xml_text: str) -> dict:
    # [xml-nbp] table A carries mid rates; the table number and date travel with every converted salary
    root = ET.fromstring(xml_text)
    table = root.find(".//ExchangeRatesTable")
    if table is None:
        raise SourceUnavailable("brak ExchangeRatesTable w XML")
    rates = {r.findtext("Code"): float(r.findtext("Mid")) for r in table.iter("Rate")}
    rates["PLN"] = 1.0
    return {"table_no": table.findtext("No"), "effective_date": table.findtext("EffectiveDate"), "rates": rates}


def extract_nbp(snapshot_dir: Path, try_live: bool) -> SourceResult:
    def live():
        body, status = _http_get(NBP_URL, LIVE_TIMEOUT_S)
        table = parse_nbp_xml(body.decode("utf-8"))
        return table, status, len(body), {"table_no": table["table_no"], "effective_date": table["effective_date"]}

    def snapshot():
        table = parse_nbp_xml((snapshot_dir / "nbp_table_a.xml").read_text(encoding="utf-8"))
        return table, {"table_no": table["table_no"], "effective_date": table["effective_date"]}

    result = _with_fallback("nbp", NBP_URL, live, snapshot, try_live)
    result.meta["rates"] = len(result.records["rates"])
    return result


def read_gus_xlsx(source: Path | io.BytesIO) -> pd.DataFrame:
    # [xlsx-gus] BDL exports put title rows above the grid, so locate the header row instead of trusting row 0
    sheet = pd.read_excel(source, header=None, dtype=str, engine="openpyxl")
    header_row = sheet.index[sheet.iloc[:, 0].astype(str).str.strip().eq("Kod")][0]
    grid = sheet.iloc[header_row + 1:].copy()
    grid.columns = [str(c).strip() for c in sheet.iloc[header_row]]
    grid = grid.dropna(subset=["Kod"])
    years = [c for c in grid.columns if c.isdigit()]
    long = grid.melt(id_vars=["Kod", "Nazwa"], value_vars=years, var_name="year", value_name="avg_gross_wage")
    long["avg_gross_wage"] = pd.to_numeric(long["avg_gross_wage"].str.replace(",", "."), errors="coerce")
    long["year"] = long["year"].astype(int)
    long = long.rename(columns={"Kod": "region_code", "Nazwa": "region_name"})
    long["region"] = long["region_name"].str.lower()
    long.loc[long["region_code"] == "000000000000", "region"] = "polska"
    return long[["region_code", "region", "region_name", "year", "avg_gross_wage"]].dropna()


def _bdl_to_xlsx(rows: list[dict]) -> io.BytesIO:
    """Live BDL comes as JSON; it is written to the same XLSX layout so one reader serves both paths."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Przeciętne miesięczne wynagrodzenia brutto [zł] (zmienna BDL 64428), GUS BDL API"])
    ws.append([])
    years = sorted({v["year"] for r in rows for v in r["values"]})
    ws.append(["Kod", "Nazwa", *years])
    for r in rows:
        vals = {v["year"]: v["val"] for v in r["values"]}
        ws.append([r["id"], r["name"], *[vals.get(y) for y in years]])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def extract_gus(snapshot_dir: Path, try_live: bool) -> SourceResult:
    def live():
        rows, size, status = [], 0, 200
        for level in (0, 2):
            body, status = _http_get(BDL_URL, LIVE_TIMEOUT_S, params={
                "unit-level": level, "format": "json", "year": [2023, 2024, 2025], "page-size": 50, "lang": "pl"})
            size += len(body)
            rows += json.loads(body).get("results", [])
        if len(rows) < 17:
            raise SourceUnavailable(f"BDL zwrócił {len(rows)} z 17 jednostek")
        frame = read_gus_xlsx(_bdl_to_xlsx(rows))
        return frame, status, size, {"variable": BDL_WAGE_VARIABLE}

    def snapshot():
        return read_gus_xlsx(snapshot_dir / "gus_bdl_wages.xlsx"), {"variable": BDL_WAGE_VARIABLE}

    return _with_fallback("gus", BDL_URL, live, snapshot, try_live)


def extract_all(snapshot_dir: Path, mode: str) -> dict[str, SourceResult]:
    try_live = mode == "live"
    results = {s: extract_portal(s, snapshot_dir, try_live) for s in PORTAL_ENDPOINTS}
    results["nbp"] = extract_nbp(snapshot_dir, try_live)
    results["gus"] = extract_gus(snapshot_dir, try_live)
    return results
