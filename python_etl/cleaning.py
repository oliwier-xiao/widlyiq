"""Transform stage: harmonize, validate, deduplicate, convert currencies, impute, reject outliers, classify.

Each step returns the surviving frame plus the rows it removed, and appends a
human-readable note to the record's `transform_log`, which the ETL Lab diff
inspector shows next to the raw record.
"""

from __future__ import annotations

import re
import unicodedata

import numpy as np
import pandas as pd

HOURS_PER_MONTH = 168
WORKDAYS_PER_MONTH = 21
IQR_K = 1.5
Z_LIMIT = 3.0
MIN_GROUP_N = 12
TIER_THRESHOLDS = (("S", 3.5), ("A", 2.5), ("B", 1.5), ("C", 0.0))
CATEGORIES = ("backend", "frontend", "fullstack", "data", "devops", "mobile", "testing", "security", "ai")
SENIORITY_ORDER = {"junior": 0, "mid": 1, "senior": 2, "lead": 3}
# The transform log is read in the dashboard, so its notes name values the way the UI does, not by column key.
CATEGORY_LABELS = {"backend": "Backend", "frontend": "Frontend", "fullstack": "Fullstack", "data": "Data", "devops": "DevOps",
                   "mobile": "Mobile", "testing": "Testing / QA", "security": "Security", "ai": "AI / ML", "other": "Inne"}
SENIORITY_LABELS = {"junior": "Junior", "mid": "Mid", "senior": "Senior", "lead": "Lead"}
CONTRACT_LABELS = {"b2b": "B2B", "uop": "UoP", "other": "inna"}
GROUP_WORDS = {"category": "kategoria", "seniority": "poziom", "contract": "umowa"}


def _fold(text: str | None) -> str:
    if text is None or (isinstance(text, float) and np.isnan(text)):
        return ""
    stripped = unicodedata.normalize("NFKD", str(text).replace("ł", "l").replace("Ł", "L"))
    return "".join(c for c in stripped if not unicodedata.combining(c)).lower().strip()


CATEGORY_MAP = {
    "backend": "backend", "frontend": "frontend", "fullstack": "fullstack", "data": "data", "devops": "devops",
    "mobile": "mobile", "testing": "testing", "security": "security", "ai": "ai", "artificialintelligence": "ai",
    "programista backend": "backend", "programista frontend": "frontend", "analityka danych": "data",
    "aplikacje mobilne": "mobile", "testowanie": "testing", "bezpieczenstwo it": "security",
    "sztuczna inteligencja": "ai", "bigdata": "data", "big data": "data", "qa": "testing",
}
SENIORITY_MAP = {
    "junior": "junior", "trainee": "junior", "intern": "junior", "mlodszy specjalista": "junior",
    "mid": "mid", "regular": "mid", "mid-level": "mid", "medium": "mid",
    "senior": "senior", "sr.": "senior", "starszy specjalista": "senior", "expert": "lead",
    "lead": "lead", "team leader": "lead", "head": "lead", "c_level": "lead", "manager": "lead",
}
CONTRACT_MAP = {"b2b": "b2b", "permanent": "uop", "uop": "uop", "umowa o prace": "uop",
                "zlecenie": "other", "uod": "other", "intern": "other", "mandate_contract": "other"}
PERIOD_MAP = {"month": "month", "monthly": "month", "hour": "hour", "hourly": "hour", "year": "year",
              "yearly": "year", "day": "day", "daily": "day"}
CITY_REGION = {
    "warszawa": "mazowieckie", "warsaw": "mazowieckie", "radom": "mazowieckie", "plock": "mazowieckie",
    "siedlce": "mazowieckie", "pruszkow": "mazowieckie", "piaseczno": "mazowieckie", "ostroleka": "mazowieckie",
    "krakow": "małopolskie", "tarnow": "małopolskie", "nowy sacz": "małopolskie",
    "wroclaw": "dolnośląskie", "walbrzych": "dolnośląskie", "legnica": "dolnośląskie", "jelenia gora": "dolnośląskie",
    "gdansk": "pomorskie", "gdynia": "pomorskie", "sopot": "pomorskie", "slupsk": "pomorskie",
    "katowice": "śląskie", "gliwice": "śląskie", "sosnowiec": "śląskie", "chorzow": "śląskie", "zabrze": "śląskie",
    "tychy": "śląskie", "rybnik": "śląskie", "bielsko-biala": "śląskie", "czestochowa": "śląskie", "bytom": "śląskie",
    "poznan": "wielkopolskie", "kalisz": "wielkopolskie", "konin": "wielkopolskie", "leszno": "wielkopolskie",
    "pila": "wielkopolskie", "gniezno": "wielkopolskie",
    "rzeszow": "podkarpackie", "krosno": "podkarpackie", "przemysl": "podkarpackie", "mielec": "podkarpackie",
    "tarnobrzeg": "podkarpackie", "stalowa wola": "podkarpackie", "jaslo": "podkarpackie", "sanok": "podkarpackie",
    "debica": "podkarpackie",
    "lodz": "łódzkie", "piotrkow trybunalski": "łódzkie", "belchatow": "łódzkie",
    "lublin": "lubelskie", "pulawy": "lubelskie", "zamosc": "lubelskie", "chelm": "lubelskie",
    "biala podlaska": "lubelskie",
    "szczecin": "zachodniopomorskie", "koszalin": "zachodniopomorskie",
    "bydgoszcz": "kujawsko-pomorskie", "torun": "kujawsko-pomorskie", "wloclawek": "kujawsko-pomorskie",
    "grudziadz": "kujawsko-pomorskie", "inowroclaw": "kujawsko-pomorskie",
    "bialystok": "podlaskie", "lomza": "podlaskie", "suwalki": "podlaskie",
    "opole": "opolskie", "zielona gora": "lubuskie", "gorzow wielkopolski": "lubuskie",
    "kielce": "świętokrzyskie", "olsztyn": "warmińsko-mazurskie", "elblag": "warmińsko-mazurskie",
    "elk": "warmińsko-mazurskie",
}
VOIVODESHIPS = {_fold(v): v for v in set(CITY_REGION.values())}
SKILL_ALIASES = {
    "reactjs": "React", "react.js": "React", "react": "React", "k8s": "Kubernetes", "kubernetes": "Kubernetes",
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "golang": "Go", "go": "Go", "js": "JavaScript",
    "javascript": "JavaScript", "ts": "TypeScript", "typescript": "TypeScript", "nodejs": "Node.js", "node": "Node.js",
    "node.js": "Node.js", "python3": "Python", "python": "Python", "vue": "Vue.js", "vue.js": "Vue.js",
    "dotnet": ".NET", ".net": ".NET", "c sharp": "C#", "c#": "C#", "spring boot": "Spring", "spring": "Spring",
    "amazon web services": "AWS", "aws": "AWS", "google cloud": "GCP", "gcp": "GCP", "ms azure": "Azure",
    "nextjs": "Next.js", "next.js": "Next.js", "pyspark": "Spark", "apache spark": "Spark", "spark": "Spark",
    "apache kafka": "Kafka", "kafka": "Kafka", "sklearn": "scikit-learn", "scikit-learn": "scikit-learn",
}
CATEGORY_KEYWORDS = {
    "testing": ["qa", "test", "tester", "selenium", "cypress", "playwright", "jmeter", "postman"],
    "devops": ["devops", "sre", "site reliability", "platform", "cloud engineer", "terraform", "kubernetes", "ansible"],
    "data": ["data engineer", "data analyst", "bi developer", "analytics", "big data", "spark", "airflow", "dbt",
             "snowflake", "databricks", "power bi", "tableau"],
    "ai": ["machine learning", "ml", "ai engineer", "data scientist", "mlops", "pytorch", "tensorflow", "llm", "langchain"],
    "security": ["security", "soc", "pentest", "siem", "splunk", "burp"],
    "mobile": ["android", "ios", "mobile", "flutter", "swift", "react native", "kotlin multiplatform"],
    "frontend": ["frontend", "front-end", "ui developer", "react developer", "angular", "vue", "css", "html"],
    "fullstack": ["fullstack", "full stack", "full-stack"],
    "backend": ["backend", "back-end", "java", "python developer", "go developer", ".net", "php", "node.js developer",
                "software engineer", "spring", "django", "ruby", "rust", "scala"],
}


def _note(log: pd.Series, mask, text: str | pd.Series) -> pd.Series:
    """Returns a new log column: under pandas copy-on-write an in-place edit of df[col] never reaches df."""
    mask = pd.Series(mask, index=log.index).fillna(False).astype(bool)
    return pd.Series([[*entry, text if isinstance(text, str) else text.at[idx]] if flag else entry
                      for idx, entry, flag in zip(log.index, log, mask)], index=log.index, dtype=object)


def _norm_skill(skill) -> str | None:
    key = _fold(skill)
    if not key:
        return None
    return SKILL_ALIASES.get(key, str(skill).strip())


def harmonize(raw_records: list[dict]) -> pd.DataFrame:
    """Maps each portal's labels onto one vocabulary; raw values stay alongside for the diff view."""
    df = pd.DataFrame(raw_records)
    df["offer_id"] = df["source"] + ":" + df["source_id"].astype(str)
    dup_ids = df["offer_id"].duplicated(keep="first")
    df.loc[dup_ids, "offer_id"] = df.loc[dup_ids, "offer_id"] + "#" + df.index[dup_ids].astype(str)
    df["transform_log"] = [[] for _ in range(len(df))]

    df["category"] = df["category_raw"].map(lambda v: CATEGORY_MAP.get(_fold(v)) if _fold(v) else None)
    df["seniority"] = df["seniority_raw"].map(lambda v: SENIORITY_MAP.get(_fold(v)))
    df["contract"] = df["contract_raw"].map(lambda v: CONTRACT_MAP.get(_fold(v), "other" if _fold(v) else None))
    df["period"] = df["period_raw"].map(lambda v: PERIOD_MAP.get(_fold(v), "month"))
    df["currency"] = df["currency"].map(lambda v: str(v).upper() if v is not None and v == v else None)

    def region_of(row) -> str | None:
        if _fold(row["region_raw"]) in VOIVODESHIPS:
            return VOIVODESHIPS[_fold(row["region_raw"])]
        return CITY_REGION.get(_fold(row["city"]))

    df["region"] = df.apply(region_of, axis=1)
    df.loc[df["region"].isna() & df["remote"].fillna(False).astype(bool), "region"] = "zdalnie"
    df["skills"] = df["skills_raw"].map(lambda xs: sorted({s for s in (_norm_skill(x) for x in xs) if s}))
    # Category is inferred here, not at the tier step, because imputation groups by it.
    missing_cat = df["category"].isna()
    df.loc[missing_cat, "category"] = df.loc[missing_cat].apply(lambda r: _category_from_text(r["title"], r["skills"]), axis=1)
    df["transform_log"] = _note(df["transform_log"], missing_cat, "classify-tier: kategoria z tytułu i stacku → " + df["category"].map(CATEGORY_LABELS).fillna(df["category"].astype(str)))

    changed_sen = df["seniority"].notna() & (df["seniority_raw"].map(_fold) != df["seniority"])
    df["transform_log"] = _note(df["transform_log"], changed_sen, "harmonize: poziom " + df["seniority_raw"].astype(str) + " → " + df["seniority"].map(SENIORITY_LABELS).fillna(""))
    changed_contract = df["contract"].notna() & (df["contract_raw"].map(_fold) != df["contract"])
    df["transform_log"] = _note(df["transform_log"], changed_contract, "harmonize: umowa " + df["contract_raw"].astype(str) + " → " + df["contract"].map(CONTRACT_LABELS).fillna(""))
    # Only the city-derived region is a transformation; a portal that already sent the voivodeship changed nothing.
    from_city = df["region"].notna() & (df["region"] != "zdalnie") & (df["region_raw"].map(_fold) != df["region"].map(_fold))
    df["transform_log"] = _note(df["transform_log"], from_city, "harmonize: miasto " + df["city"].astype(str) + " → " + df["region"].astype(str).str.capitalize())
    aliased = df.apply(lambda r: sorted(set(map(str, r["skills_raw"])) - set(r["skills"])), axis=1)
    df["transform_log"] = _note(df["transform_log"], aliased.map(bool), aliased.map(lambda xs: "harmonize: aliasy technologii " + ", ".join(xs)))
    for col in ("salary_from", "salary_to"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def verify_schema(df: pd.DataFrame, known_currencies: set[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    # [verify-schema] reject what cannot be repaired, repair what is unambiguous
    df = df.copy()
    reason = pd.Series(None, index=df.index, dtype=object)
    reason[df["title"].map(_fold).eq("")] = "brak tytułu"
    reason[(df["salary_from"] < 0) | (df["salary_to"] < 0)] = "ujemne wynagrodzenie"
    reason[df["currency"].notna() & ~df["currency"].isin(known_currencies)] = "nieznana waluta"
    reason[df["seniority"].isna() & df["title"].map(_fold).eq("")] = "brak tytułu i poziomu"
    rejected = df[reason.notna()].assign(stage="verify-schema", reason=reason[reason.notna()])
    df = df[reason.isna()].copy()

    swapped = df["salary_from"] > df["salary_to"]
    # copy=True matters: a zero-copy view would let the first column write clobber the second before it is read.
    df.loc[swapped, ["salary_from", "salary_to"]] = df.loc[swapped, ["salary_to", "salary_from"]].to_numpy(copy=True)
    df["transform_log"] = _note(df["transform_log"], swapped, "verify-schema: zamienione widełki od/do")

    # A monthly PLN salary below 200 is almost always written in thousands ("18,5" for 18 500).
    in_thousands = (df["period"] == "month") & (df["currency"] == "PLN") & (df["salary_to"] < 200) & (df["salary_to"] > 0)
    df.loc[in_thousands, ["salary_from", "salary_to"]] *= 1000
    df["transform_log"] = _note(df["transform_log"], in_thousands, "verify-schema: kwota w tysiącach ×1000")

    missing_level = df["seniority"].isna()
    df.loc[missing_level, "seniority"] = df.loc[missing_level, "title"].map(_seniority_from_title)
    df["transform_log"] = _note(df["transform_log"], missing_level, "verify-schema: poziom z tytułu → " + df["seniority"].map(SENIORITY_LABELS).fillna(df["seniority"].astype(str)))
    return df, rejected


def _seniority_from_title(title) -> str:
    t = _fold(title)
    for word, level in (("junior", "junior"), ("senior", "senior"), ("lead", "lead"), ("principal", "lead"),
                        ("staff", "lead"), ("head", "lead"), ("mid", "mid"), ("regular", "mid")):
        if re.search(rf"\b{word}\b", t):
            return level
    return "mid"


def deduplicate(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Reposts and cross-posted offers share title, company, city and level, whatever the portal or id."""
    df = df.copy()
    key = (df["title"].map(_fold) + "|" + df["company"].map(_fold) + "|" + df["city"].map(_fold) + "|"
           + df["seniority"].astype(str))
    # Prefer the copy that discloses salary, then the earliest listing.
    order = df.assign(_has_salary=df["salary_to"].notna(), _key=key).sort_values(
        ["_key", "_has_salary", "published_at"], ascending=[True, False, True])
    first = order.groupby("_key")["offer_id"].transform("first")
    is_dup = order["offer_id"] != first
    rejected = df.loc[order.index[is_dup]].assign(stage="dedupe", reason="duplikat " + first[is_dup])
    return df.drop(index=order.index[is_dup]), rejected


def normalize_currency(df: pd.DataFrame, nbp: dict) -> pd.DataFrame:
    # [normalize-nbp] NBP mid rate to PLN, then hourly x168 h, yearly /12, daily x21 to a monthly figure
    df = df.copy()
    rates = nbp["rates"]
    df["fx_rate"] = df["currency"].map(lambda c: rates.get(c, np.nan) if c else 1.0)
    df["fx_table"] = nbp["table_no"]
    factor = df["period"].map({"month": 1.0, "hour": HOURS_PER_MONTH, "year": 1 / 12, "day": WORKDAYS_PER_MONTH}).fillna(1.0)
    for col in ("salary_from", "salary_to"):
        df[f"{col}_pln"] = (df[col] * df["fx_rate"] * factor).round(0)
    df["salary_pln_month"] = df[["salary_from_pln", "salary_to_pln"]].mean(axis=1, skipna=True).round(0)

    foreign = df["currency"].notna() & (df["currency"] != "PLN") & df["salary_to"].notna()
    df["transform_log"] = _note(df["transform_log"], foreign, "normalize-nbp: " + df["currency"].astype(str) + " × "
          + df["fx_rate"].map(lambda r: f"{r:.4f}".replace(".", ",")) + " (" + df["fx_table"] + ")")
    hourly = (df["period"] == "hour") & df["salary_to"].notna()
    df["transform_log"] = _note(df["transform_log"], hourly, f"normalize-nbp: stawka godzinowa × {HOURS_PER_MONTH} h")
    return df


def impute_median(df: pd.DataFrame) -> pd.DataFrame:
    # [impute-median] medians are robust to the outliers still present, so imputing before the IQR pass is safe
    df = df.copy()
    df["is_imputed"] = 0
    df["imputation_group"] = None
    for keys in (["category", "seniority", "contract"], ["seniority", "contract"], ["seniority"]):
        missing = df["salary_pln_month"].isna()
        if not missing.any():
            break
        observed = df[~missing & ~df["is_imputed"].astype(bool)]
        medians = observed.groupby(keys, dropna=False)["salary_pln_month"].median()
        counts = observed.groupby(keys, dropna=False)["salary_pln_month"].size()
        usable = medians[counts >= 5]
        fill = df.loc[missing, keys].apply(lambda r: usable.get(tuple(r) if len(keys) > 1 else r.iloc[0], np.nan), axis=1)
        filled = fill.notna()
        idx = fill.index[filled]
        df.loc[idx, "salary_pln_month"] = fill[filled].round(-1)
        df.loc[idx, "is_imputed"] = 1
        df.loc[idx, "imputation_group"] = " × ".join(keys)
        df["transform_log"] = _note(df["transform_log"], df.index.isin(idx), "impute-median: mediana grupy " + " × ".join(GROUP_WORDS[k] for k in keys))
    return df[df["salary_pln_month"].notna()].copy()


def filter_outliers(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    # [filter-iqr] salaries are log-normal, so fences sit on log(salary): equal tolerance up and down
    df = df.copy()
    df["log_salary"] = np.log(df["salary_pln_month"].clip(lower=1))
    observed = df["is_imputed"] == 0
    df["group_key"] = df["category"].fillna("?") + " × " + df["seniority"] + " × " + df["contract"].fillna("?")
    coarse = df["seniority"] + " × " + df["contract"].fillna("?")
    sizes = df[observed].groupby("group_key").size()
    df["fence_key"] = np.where(df["group_key"].map(sizes).fillna(0) >= MIN_GROUP_N, df["group_key"], coarse)

    stats = df[observed].groupby("fence_key")["log_salary"].agg(
        q1=lambda s: s.quantile(0.25), q3=lambda s: s.quantile(0.75), mu="mean", sd="std")
    joined = df.join(stats, on="fence_key")
    iqr = joined["q3"] - joined["q1"]
    lo, hi = joined["q1"] - IQR_K * iqr, joined["q3"] + IQR_K * iqr
    z = (joined["log_salary"] - joined["mu"]) / joined["sd"].replace(0, np.nan)
    df["lower_fence"] = np.exp(lo).round(0)
    df["upper_fence"] = np.exp(hi).round(0)
    df["z_score"] = z.round(2)

    reason = pd.Series(None, index=df.index, dtype=object)
    reason[observed & (joined["log_salary"] > hi)] = "IQR: powyżej górnego płotka"
    reason[observed & (joined["log_salary"] < lo)] = "IQR: poniżej dolnego płotka"
    # Z-score catches extreme values in groups whose IQR collapsed to near zero.
    reason[observed & reason.isna() & (z.abs() > Z_LIMIT)] = f"ponad {Z_LIMIT:g} odchylenia standardowe od średniej grupy"
    # A small group borrows its fences from the coarser key, so the rejected row names the group the fences came from.
    rejected = df[reason.notna()].assign(stage="filter-iqr", reason=reason[reason.notna()], group_key=df["fence_key"])
    return df[reason.isna()].copy(), rejected


def _category_from_text(title, skills: list[str]) -> str:
    # [classify-tier] keyword scoring over title and stack; ties resolve to dictionary order, unknowns to backend
    text = _fold(title) + " " + " ".join(_fold(s) for s in skills)
    scores = {c: sum(1 for kw in kws if re.search(rf"(?<![a-z]){re.escape(kw)}(?![a-z])", text))
              for c, kws in CATEGORY_KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "backend"


def classify(df: pd.DataFrame, gus: pd.DataFrame) -> pd.DataFrame:
    # [classify-tier] missing categories from title and stack; income tier from the multiple of the regional GUS wage
    df = df.copy()
    df["category"] = df["category"].where(df["category"].isin(CATEGORIES), "other")
    latest = gus[gus["year"] == gus["year"].max()].set_index("region")["avg_gross_wage"]
    df["gus_year"] = int(gus["year"].max())
    df["gus_wage"] = df["region"].map(latest).fillna(latest["polska"])
    df["gus_multiple"] = (df["salary_pln_month"] / df["gus_wage"]).round(2)
    df["tier"] = df["gus_multiple"].map(lambda m: next(t for t, lim in TIER_THRESHOLDS if m >= lim))
    df["seniority_rank"] = df["seniority"].map(SENIORITY_ORDER)
    return df
