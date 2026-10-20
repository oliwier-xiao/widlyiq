"""Builds the offline fallback snapshots that the pipeline reads when live sources fail.

Portal snapshots are synthetic. They are sampled from a known salary model
(GROUND_TRUTH below) so the cleaning and Ridge stages can be checked against
the values that generated the data. NBP and GUS snapshots are copies of the
real public tables, fetched live when the network allows.

Run: .venv/bin/python -m python_etl.snapshots.build_snapshots
"""

from __future__ import annotations

import json
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests
from openpyxl import Workbook

SNAPSHOT_DIR = Path(__file__).resolve().parent
SEED = 20261018
N_UNIQUE = 1236
USER_AGENT = "WidlyIQ/0.1 (university data-analysis project)"

# Known generating model. Monthly B2B net PLN for an average region.
BASE_BY_SENIORITY = {"junior": 9_500, "mid": 17_500, "senior": 25_500, "lead": 31_000}
CATEGORY_FACTOR = {
    "backend": 1.00, "frontend": 0.94, "fullstack": 0.98, "data": 1.03, "devops": 1.08,
    "mobile": 0.97, "testing": 0.80, "security": 1.06, "ai": 1.12,
}
CATEGORY_WEIGHT = {
    "backend": 0.26, "frontend": 0.12, "fullstack": 0.12, "data": 0.13, "devops": 0.10,
    "mobile": 0.06, "testing": 0.09, "security": 0.05, "ai": 0.07,
}
SKILL_PREMIUM = {
    "Rust": 3200, "LLM": 2600, "Scala": 2600, "Go": 2400, "PyTorch": 2300, "Kubernetes": 2200,
    "Spark": 2000, "Terraform": 1900, "Kafka": 1800, "Databricks": 1700, "AWS": 1500,
    "LangChain": 1500, "Penetration Testing": 1500, "Snowflake": 1400, "GCP": 1300,
    "TensorFlow": 1200, "Azure": 1100, "Swift": 1000, "Kotlin": 900, "Airflow": 900,
    "MLflow": 900, "Splunk": 900, "dbt": 800, "SIEM": 800, "Next.js": 700, "Microservices": 700,
    "Burp Suite": 700, "TypeScript": 600, "Java": 600, "Spring": 600, "Ruby": 600, "Ansible": 600,
    "React": 500, "Python": 500, "GraphQL": 500, "FastAPI": 500, "Playwright": 500, "iOS": 500,
    "Prometheus": 500, "Node.js": 400, "Docker": 400, "React Native": 400, "scikit-learn": 400,
    "ISO 27001": 400, "C#": 300, ".NET": 300, "PostgreSQL": 300, "Redis": 300, "Django": 300,
    "Flutter": 300, "Android": 300, "GitLab CI": 300, "Grafana": 300, "Angular": 200,
    "Cypress": 200, "Bash": 200, "Linux": 200, "Dart": 200, "Pandas": 100, "Tailwind": 100,
    "Redux": 100, "Jest": 100, "JMeter": 100, "SQL": 0, "REST": 0, "Vue.js": 0, "Jenkins": 0,
    "JavaScript": 0, "MySQL": -100, "Selenium": -200, "Webpack": -200, "Firebase": -200,
    "CSS": -300, "Postman": -300, "HTML": -400, "Tableau": -400, "Symfony": -500,
    "Power BI": -500, "Jira": -600, "Laravel": -900, "PHP": -1300, "jQuery": -1800,
}
SKILL_POOL = {
    "backend": ["Java", "Spring", "Kotlin", "Python", "Django", "FastAPI", "Go", "C#", ".NET", "Node.js",
                "PHP", "Symfony", "Laravel", "Ruby", "Rust", "Scala", "PostgreSQL", "MySQL", "Redis",
                "Kafka", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Microservices", "REST", "GraphQL"],
    "frontend": ["JavaScript", "TypeScript", "React", "Next.js", "Angular", "Vue.js", "HTML", "CSS",
                 "Tailwind", "Redux", "jQuery", "Webpack", "Jest", "Cypress", "GraphQL"],
    "fullstack": ["TypeScript", "JavaScript", "React", "Node.js", "Next.js", "Python", "Java", "PHP",
                  "PostgreSQL", "Docker", "AWS", "GraphQL", "Angular", "Vue.js"],
    "data": ["Python", "SQL", "Spark", "Airflow", "dbt", "Snowflake", "Databricks", "Pandas", "Scala",
             "Kafka", "AWS", "Azure", "Power BI", "Tableau", "PostgreSQL"],
    "devops": ["Kubernetes", "Docker", "Terraform", "AWS", "Azure", "GCP", "Linux", "Ansible", "Jenkins",
               "GitLab CI", "Prometheus", "Grafana", "Python", "Go", "Bash"],
    "mobile": ["Kotlin", "Swift", "Android", "iOS", "Flutter", "Dart", "React Native", "TypeScript", "Firebase"],
    "testing": ["Selenium", "Cypress", "Playwright", "Java", "Python", "JavaScript", "TypeScript", "Postman",
                "JMeter", "SQL", "Jira"],
    "security": ["Python", "Linux", "SIEM", "Splunk", "AWS", "Azure", "Kubernetes", "Penetration Testing",
                 "Burp Suite", "ISO 27001", "Bash"],
    "ai": ["Python", "PyTorch", "TensorFlow", "LLM", "LangChain", "scikit-learn", "Pandas", "SQL", "AWS",
           "Kubernetes", "MLflow", "Spark"],
}
# Weighted cities: Podkarpackie is oversampled on purpose so the regional lens has a usable sample.
CITIES = [
    ("Warszawa", "mazowieckie", 0.24), ("Kraków", "małopolskie", 0.135), ("Wrocław", "dolnośląskie", 0.105),
    ("Gdańsk", "pomorskie", 0.055), ("Gdynia", "pomorskie", 0.02), ("Katowice", "śląskie", 0.055),
    ("Gliwice", "śląskie", 0.02), ("Poznań", "wielkopolskie", 0.065), ("Rzeszów", "podkarpackie", 0.10),
    ("Krosno", "podkarpackie", 0.008), ("Przemyśl", "podkarpackie", 0.006), ("Łódź", "łódzkie", 0.04),
    ("Lublin", "lubelskie", 0.03), ("Szczecin", "zachodniopomorskie", 0.02), ("Bydgoszcz", "kujawsko-pomorskie", 0.01),
    ("Toruń", "kujawsko-pomorskie", 0.006), ("Białystok", "podlaskie", 0.012), ("Opole", "opolskie", 0.006),
    ("Zielona Góra", "lubuskie", 0.005), ("Kielce", "świętokrzyskie", 0.006), ("Olsztyn", "warmińsko-mazurskie", 0.006),
    (None, None, 0.059),
]
REGION_FACTOR = {
    "mazowieckie": 1.10, "małopolskie": 1.04, "dolnośląskie": 1.03, "pomorskie": 1.00, "śląskie": 0.97,
    "wielkopolskie": 0.96, "łódzkie": 0.92, "podkarpackie": 0.88, "lubelskie": 0.86, "zachodniopomorskie": 0.92,
    "kujawsko-pomorskie": 0.88, "opolskie": 0.87, "podlaskie": 0.87, "lubuskie": 0.86, "świętokrzyskie": 0.85,
    "warmińsko-mazurskie": 0.85, None: 1.02,
}
SENIORITY_WEIGHT = {"junior": 0.14, "mid": 0.38, "senior": 0.36, "lead": 0.12}
PORTAL_BIAS = {"nofluffjobs": 1.05, "justjoinit": 1.02, "solidjobs": 0.96}
PORTAL_WEIGHT = {"nofluffjobs": 0.39, "justjoinit": 0.31, "solidjobs": 0.30}
HOURLY_SHARE = {"nofluffjobs": 0.06, "justjoinit": 0.09, "solidjobs": 0.14}
UOP_SHARE = 0.26
# B2B net invoices run above UoP gross for the same role; 1.22 is the conventional rule of thumb.
B2B_TO_UOP = 1.22
NOISE_SIGMA = 0.16

GROUND_TRUTH = {
    "base_by_seniority": BASE_BY_SENIORITY, "category_factor": CATEGORY_FACTOR,
    "region_factor": {k or "zdalnie": v for k, v in REGION_FACTOR.items()},
    "portal_bias": PORTAL_BIAS, "skill_premium_pln": SKILL_PREMIUM, "noise_sigma": NOISE_SIGMA,
    "b2b_to_uop": B2B_TO_UOP,
}

FALLBACK_FX = {"EUR": 4.3716, "USD": 3.8959, "GBP": 5.0712, "CHF": 4.7520, "HUF": 0.010812}
# Rates used to express PLN offers in foreign currency; replaced by the fetched NBP table so ETL conversion round-trips.
FX = dict(FALLBACK_FX)
# Real GUS BDL values (variable 64428, przeciętne miesięczne wynagrodzenia brutto, zł), used when BDL is unreachable.
FALLBACK_GUS = {
    "000000000000": ("POLSKA", 7595.30, 8630.27, 9371.11),
    "011200000000": ("MAŁOPOLSKIE", 7736.56, 8818.71, 9613.68),
    "012400000000": ("ŚLĄSKIE", 7611.38, 8537.54, 9204.61),
    "020800000000": ("LUBUSKIE", 6882.46, 7887.19, 8497.37),
    "023000000000": ("WIELKOPOLSKIE", 6772.06, 7759.22, 8315.70),
    "023200000000": ("ZACHODNIOPOMORSKIE", 7007.40, 8027.37, 8748.11),
    "030200000000": ("DOLNOŚLĄSKIE", 7850.30, 8867.46, 9577.68),
    "031600000000": ("OPOLSKIE", 6975.81, 7958.35, 8709.50),
    "040400000000": ("KUJAWSKO-POMORSKIE", 6721.48, 7710.78, 8409.11),
    "042200000000": ("POMORSKIE", 7550.99, 8620.28, 9413.62),
    "042800000000": ("WARMIŃSKO-MAZURSKIE", 6447.09, 7529.41, 8207.95),
    "051000000000": ("ŁÓDZKIE", 7052.93, 8096.32, 8795.68),
    "052600000000": ("ŚWIĘTOKRZYSKIE", 6585.16, 7664.18, 8361.83),
    "060600000000": ("LUBELSKIE", 6774.52, 7771.05, 8495.36),
    "061800000000": ("PODKARPACKIE", 6436.15, 7514.69, 8195.62),
    "062000000000": ("PODLASKIE", 6805.04, 7850.16, 8580.20),
    "071400000000": ("MAZOWIECKIE", 8928.60, 10018.71, 10914.07),
}

COMPANY_HEAD = ["Nordwave", "Kodwerk", "Lumenit", "Datalia", "Vistrum", "Orbitex", "Pixelmark", "Quantra",
                "Sigmatic", "Teranode", "Fluxio", "Arcadis Soft", "Miraform", "Bitgrove", "Cloudane", "Vectorix",
                "Deltaline", "Nexora", "Karbonit", "Wisłoka Data", "Sanoknet", "Bieszcz Labs", "Polaris Code",
                "Grafit Systems", "Hexamon", "Rzeka Software", "Zenbyte", "Opalix", "Brightgate", "Stalwart IT"]
COMPANY_TAIL = ["Sp. z o.o.", "S.A.", "Sp. z o.o. Sp. k.", "Group", "Poland"]
TITLE_ROLE = {
    "backend": ["Backend Developer", "Backend Engineer", "Software Engineer", "Java Developer", "Python Developer",
                "Go Developer", ".NET Developer", "PHP Developer", "Node.js Developer"],
    "frontend": ["Frontend Developer", "React Developer", "Angular Developer", "Frontend Engineer", "UI Developer"],
    "fullstack": ["Fullstack Developer", "Full Stack Engineer", "Fullstack JavaScript Developer"],
    "data": ["Data Engineer", "Data Analyst", "BI Developer", "Analytics Engineer", "Big Data Engineer"],
    "devops": ["DevOps Engineer", "Platform Engineer", "Site Reliability Engineer", "Cloud Engineer"],
    "mobile": ["Android Developer", "iOS Developer", "Mobile Developer", "Flutter Developer"],
    "testing": ["QA Engineer", "Test Automation Engineer", "Manual Tester", "QA Analyst"],
    "security": ["Security Engineer", "SOC Analyst", "Pentester", "Cloud Security Engineer"],
    "ai": ["Machine Learning Engineer", "AI Engineer", "Data Scientist", "MLOps Engineer"],
}
SENIORITY_PREFIX = {"junior": "Junior", "mid": "", "senior": "Senior", "lead": "Lead"}


def _fetch_nbp_xml() -> str | None:
    try:
        r = requests.get("https://api.nbp.pl/api/exchangerates/tables/A/?format=xml",
                         headers={"User-Agent": USER_AGENT}, timeout=10)
        r.raise_for_status()
        return r.text
    except requests.RequestException:
        return None


def _fallback_nbp_xml() -> str:
    rates = "".join(f"<Rate><Currency>{c}</Currency><Code>{c}</Code><Mid>{v}</Mid></Rate>" for c, v in FALLBACK_FX.items())
    return ('<?xml version="1.0" encoding="utf-8"?><ArrayOfExchangeRatesTable><ExchangeRatesTable>'
            "<Table>A</Table><No>204/A/NBP/2026</No><EffectiveDate>2026-10-20</EffectiveDate>"
            f"<Rates>{rates}</Rates></ExchangeRatesTable></ArrayOfExchangeRatesTable>")


def _fetch_gus() -> dict[str, tuple[str, float, float, float]] | None:
    out: dict[str, tuple[str, float, float, float]] = {}
    try:
        for level in (0, 2):
            r = requests.get(
                "https://bdl.stat.gov.pl/api/v1/data/by-variable/64428",
                params={"unit-level": level, "format": "json", "year": [2023, 2024, 2025], "page-size": 50, "lang": "pl"},
                headers={"User-Agent": USER_AGENT}, timeout=15)
            r.raise_for_status()
            for row in r.json()["results"]:
                vals = {v["year"]: float(v["val"]) for v in row["values"]}
                out[row["id"]] = (row["name"], vals["2023"], vals["2024"], vals["2025"])
    except (requests.RequestException, KeyError, ValueError):
        return None
    return out if len(out) == 17 else None


def write_gus_xlsx(rows: dict[str, tuple[str, float, float, float]], path: Path, source_note: str) -> None:
    """Mirrors the layout of a BDL "tablica" export: title rows, then a code/name/year grid."""
    wb = Workbook()
    ws = wb.active
    ws.title = "TABLICA"
    ws.append(["Wynagrodzenia i świadczenia społeczne"])
    ws.append(["Przeciętne miesięczne wynagrodzenia brutto, ogółem [zł] (zmienna BDL 64428)"])
    ws.append([source_note])
    ws.append([])
    ws.append(["Kod", "Nazwa", "2023", "2024", "2025"])
    for code, (name, y23, y24, y25) in sorted(rows.items()):
        ws.append([code, name, y23, y24, y25])
    wb.save(path)


def _company(rng: np.random.Generator) -> str:
    return f"{rng.choice(COMPANY_HEAD)} {rng.choice(COMPANY_TAIL)}"


def _skills(rng: np.random.Generator, category: str) -> list[str]:
    pool = SKILL_POOL[category]
    k = int(np.clip(rng.poisson(4.2), 2, 8))
    return list(rng.choice(pool, size=min(k, len(pool)), replace=False))


def _true_salary(rng: np.random.Generator, seniority: str, category: str, region: str | None,
                 skills: list[str], portal: str, contract: str) -> float:
    value = BASE_BY_SENIORITY[seniority] * CATEGORY_FACTOR[category] * REGION_FACTOR[region]
    value += sum(SKILL_PREMIUM.get(s, 0) for s in skills) * (0.6 + 0.2 * list(BASE_BY_SENIORITY).index(seniority))
    value *= PORTAL_BIAS[portal] * rng.lognormal(0.0, NOISE_SIGMA)
    return value / B2B_TO_UOP if contract == "uop" else value


def _sample_offer(rng: np.random.Generator, idx: int, start: datetime) -> dict:
    portal = rng.choice(list(PORTAL_WEIGHT), p=list(PORTAL_WEIGHT.values()))
    category = rng.choice(list(CATEGORY_WEIGHT), p=list(CATEGORY_WEIGHT.values()))
    seniority = rng.choice(list(SENIORITY_WEIGHT), p=list(SENIORITY_WEIGHT.values()))
    weights = np.array([c[2] for c in CITIES])
    city, region, _ = CITIES[rng.choice(len(CITIES), p=weights / weights.sum())]
    contract = "uop" if rng.random() < UOP_SHARE else "b2b"
    skills = _skills(rng, category)
    salary = _true_salary(rng, seniority, category, region, skills, portal, contract)
    spread = rng.uniform(0.08, 0.22)
    lo, hi = round(salary * (1 - spread), -2), round(salary * (1 + spread), -2)
    period, currency = "month", "PLN"
    if rng.random() < HOURLY_SHARE[portal]:
        lo, hi, period = round(lo / 168, 0), round(hi / 168, 0), "hour"
    roll = rng.random()
    if roll < 0.04:
        currency = "EUR"
    elif roll < 0.055:
        currency = "USD"
    elif roll < 0.06:
        currency = rng.choice(["GBP", "CHF"])
    if currency != "PLN":
        rate = FX[currency]
        lo, hi = round(lo / rate, 0 if period == "hour" else -1), round(hi / rate, 0 if period == "hour" else -1)
    role = rng.choice(TITLE_ROLE[category])
    title = f"{SENIORITY_PREFIX[seniority]} {role}".strip()
    published = start - timedelta(days=int(rng.integers(0, 28)), minutes=int(rng.integers(0, 1440)))
    return {
        "key": idx, "portal": portal, "category": category, "seniority": seniority, "city": city,
        "region": region, "contract": contract, "skills": skills, "from": lo, "to": hi, "period": period,
        "currency": currency, "title": title, "company": _company(rng), "published": published,
        "remote": city is None or rng.random() < 0.18,
    }


def _inject_anomalies(rng: np.random.Generator, offers: list[dict]) -> list[dict]:
    """Plants the defects each cleaning stage must catch, in proportions seen on real job boards."""
    n = len(offers)
    picks = rng.permutation(n)
    cursor = 0

    def take(count: int) -> list[dict]:
        nonlocal cursor
        chosen = [offers[i] for i in picks[cursor:cursor + count]]
        cursor += count
        return chosen

    for o in take(int(n * 0.115)):
        o["from"] = o["to"] = None
    for o in take(int(n * 0.015)):
        o["from"], o["to"] = o["to"], o["from"]
    for o in take(int(n * 0.010)):
        if o["period"] == "month" and o["currency"] == "PLN":
            o["from"], o["to"] = round(o["from"] / 1000, 1), round(o["to"] / 1000, 1)
    for o in take(int(n * 0.022)):
        factor = rng.choice([rng.uniform(3.0, 7.0), rng.uniform(0.12, 0.3)])
        o["from"], o["to"] = round(o["from"] * factor, -1), round(o["to"] * factor, -1)
    for o in take(4):
        o["from"], o["to"] = 950_000, 1_000_000
    broken = take(18)
    for i, o in enumerate(broken):
        kind = i % 4
        if kind == 0:
            o["title"] = ""
        elif kind == 1:
            o["from"], o["to"] = -abs(o["from"] or 12000), -abs(o["to"] or 15000)
        elif kind == 2:
            o["currency"] = "XYZ"
        else:
            o["seniority"] = None
            o["title"] = None
    for o in take(int(n * 0.04)):
        o["category_hidden"] = True

    duplicates = []
    for o in take(46):
        duplicates.append({**o, "key": f"{o['key']}-repost"})
    for o in take(25):
        other = rng.choice([p for p in PORTAL_WEIGHT if p != o["portal"]])
        duplicates.append({**o, "key": f"{o['key']}-x", "portal": other})
    return offers + duplicates


SKILL_ALIASES = {"React": ["ReactJS", "React.js", "react"], "Kubernetes": ["K8s", "k8s"], "PostgreSQL": ["Postgres"],
                 "Go": ["Golang"], "JavaScript": ["JS"], "TypeScript": ["TS"], "Node.js": ["NodeJS", "node"],
                 "Python": ["python3"], "Vue.js": ["Vue"], ".NET": ["dotnet"], "C#": ["C Sharp"]}


def _alias(rng: np.random.Generator, skill: str) -> str:
    if skill in SKILL_ALIASES and rng.random() < 0.3:
        return str(rng.choice(SKILL_ALIASES[skill]))
    return skill


def _salary_or_none(o: dict, key: str):
    v = o[key]
    return None if v is None else float(v)


def to_nofluffjobs(rng: np.random.Generator, o: dict) -> dict:
    seniority = {"junior": "Junior", "mid": "Mid", "senior": "Senior", "lead": rng.choice(["Lead", "Expert"])}
    contract = {"b2b": "b2b", "uop": "permanent"}[o["contract"]]
    record = {
        "id": f"{o['title'] or 'offer'}-{o['company']}-{o['key']}".lower().replace(" ", "-"),
        "name": o["company"], "title": o["title"], "category": o["category"] if not o.get("category_hidden") else "other",
        "seniority": [seniority[o["seniority"]]] if o["seniority"] else [],
        "location": {"places": [{"country": {"code": "pl"}, "city": o["city"]}] if o["city"] else [],
                     "fullyRemote": o["city"] is None, "type": "remote" if o["remote"] else "hybrid"},
        "posted": int(o["published"].timestamp() * 1000),
        "salary": None if o["from"] is None else {
            "from": _salary_or_none(o, "from"), "to": _salary_or_none(o, "to"), "type": contract,
            "currency": o["currency"], "period": "Hour" if o["period"] == "hour" else "Month"},
        "tiles": {"values": [{"value": _alias(rng, s), "type": "requirement"} for s in o["skills"]]},
        "regions": ["pl"],
    }
    return record


JJIT_LEVEL = {"junior": "junior", "mid": "mid", "senior": "senior", "lead": "c_level"}
JJIT_CATEGORY = {"backend": 2, "frontend": 1, "fullstack": 3, "data": 6, "devops": 7, "mobile": 4,
                 "testing": 9, "security": 11, "ai": 25}


def to_justjoinit(rng: np.random.Generator, o: dict) -> dict:
    employment = [] if o["from"] is None else [{
        "from": _salary_or_none(o, "from"), "to": _salary_or_none(o, "to"), "currency": o["currency"].lower(),
        "type": {"b2b": "b2b", "uop": "permanent"}[o["contract"]], "unit": o["period"], "gross": o["contract"] == "uop"}]
    return {
        "slug": f"{o['company']}-{o['title'] or 'offer'}-{o['key']}".lower().replace(" ", "-").replace(".", ""),
        "title": o["title"], "companyName": o["company"], "city": o["city"] or "Remote",
        "workplaceType": "remote" if o["remote"] else rng.choice(["hybrid", "office"]),
        "experienceLevel": JJIT_LEVEL.get(o["seniority"]) if o["seniority"] else None,
        "categoryId": None if o.get("category_hidden") else JJIT_CATEGORY[o["category"]],
        "employmentTypes": employment, "requiredSkills": [_alias(rng, s) for s in o["skills"]],
        "publishedAt": o["published"].isoformat(),
    }


SOLID_LEVEL = {"junior": ["Junior", "Młodszy specjalista"], "mid": ["Mid", "Regular", "Mid-level"],
               "senior": ["Senior", "Starszy specjalista", "Sr."], "lead": ["Lead", "Team Leader"]}
SOLID_CATEGORY = {"backend": "Programista Backend", "frontend": "Programista Frontend", "fullstack": "Fullstack",
                  "data": "Analityka danych", "devops": "DevOps", "mobile": "Aplikacje mobilne", "testing": "Testowanie",
                  "security": "Bezpieczeństwo IT", "ai": "Sztuczna inteligencja"}


def to_solidjobs(rng: np.random.Generator, o: dict) -> dict:
    hidden = o.get("category_hidden") or rng.random() < 0.12
    return {
        "id": 100_000 + zlib.crc32(str(o["key"]).encode()) % 900_000,
        "jobTitle": o["title"], "companyName": o["company"],
        "category": None if hidden else SOLID_CATEGORY[o["category"]],
        "experienceLevel": str(rng.choice(SOLID_LEVEL[o["seniority"]])) if o["seniority"] else None,
        "salaryRange": None if o["from"] is None else {
            "lowerBound": _salary_or_none(o, "from"), "upperBound": _salary_or_none(o, "to"), "currency": o["currency"],
            "period": "Hourly" if o["period"] == "hour" else "Monthly", "contractType": "B2B" if o["contract"] == "b2b" else "UoP"},
        "requiredSkills": [{"name": _alias(rng, s), "level": int(rng.integers(2, 5))} for s in o["skills"]],
        "city": o["city"], "region": o["region"], "remotePossible": bool(o["remote"]),
        "publishedOn": o["published"].date().isoformat(),
    }


def _rates_from_xml(xml: str) -> dict[str, float]:
    import xml.etree.ElementTree as ET

    return {r.findtext("Code"): float(r.findtext("Mid")) for r in ET.fromstring(xml).iter("Rate")}


def build() -> dict[str, int]:
    xml = _fetch_nbp_xml() or _fallback_nbp_xml()
    FX.update({k: v for k, v in _rates_from_xml(xml).items() if k in FALLBACK_FX})
    rng = np.random.default_rng(SEED)
    start = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)
    offers = [_sample_offer(rng, i, start) for i in range(N_UNIQUE)]
    offers = _inject_anomalies(rng, offers)
    offers = [offers[i] for i in rng.permutation(len(offers))]

    adapters = {"nofluffjobs": to_nofluffjobs, "justjoinit": to_justjoinit, "solidjobs": to_solidjobs}
    payloads: dict[str, list[dict]] = {p: [] for p in adapters}
    for o in offers:
        payloads[o["portal"]].append(adapters[o["portal"]](rng, o))

    (SNAPSHOT_DIR / "nofluffjobs.json").write_text(json.dumps(
        {"postings": payloads["nofluffjobs"], "totalCount": len(payloads["nofluffjobs"]), "synthetic": True},
        ensure_ascii=False, indent=1), encoding="utf-8")
    (SNAPSHOT_DIR / "justjoinit.json").write_text(json.dumps(
        {"data": payloads["justjoinit"], "meta": {"totalItems": len(payloads["justjoinit"]), "synthetic": True}},
        ensure_ascii=False, indent=1), encoding="utf-8")
    (SNAPSHOT_DIR / "solidjobs.json").write_text(json.dumps(
        {"offers": payloads["solidjobs"], "count": len(payloads["solidjobs"]), "synthetic": True},
        ensure_ascii=False, indent=1), encoding="utf-8")

    (SNAPSHOT_DIR / "nbp_table_a.xml").write_text(xml, encoding="utf-8")
    gus = _fetch_gus()
    stamp = datetime.now(timezone.utc).date().isoformat()
    note = f"Źródło: GUS BDL API, pobrano {stamp}" if gus else "Źródło: GUS BDL, wartości wbudowane (bez sieci)"
    write_gus_xlsx(gus or FALLBACK_GUS, SNAPSHOT_DIR / "gus_bdl_wages.xlsx", note)
    (SNAPSHOT_DIR / "ground_truth.json").write_text(json.dumps(GROUND_TRUTH, ensure_ascii=False, indent=1), encoding="utf-8")
    return {p: len(v) for p, v in payloads.items()}


if __name__ == "__main__":
    counts = build()
    print(json.dumps({"records": counts, "total": sum(counts.values())}))
