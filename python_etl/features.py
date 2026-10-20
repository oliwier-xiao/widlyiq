"""Feature engineering: skill vocabulary, one-hot and ordinal encodings, scaling, co-occurrence X.T @ X."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import sparse
from scipy.cluster.hierarchy import fcluster, leaves_list, linkage
from scipy.spatial.distance import squareform
from sklearn.preprocessing import StandardScaler

TOP_SKILLS = 40
MIN_SKILL_COUNT = 8
NUMERIC = ["gus_wage", "n_skills", "seniority_rank"]
ONE_HOT = {"seniority": ["junior", "mid", "senior", "lead"],
           "category": ["backend", "frontend", "fullstack", "data", "devops", "mobile", "testing", "security", "ai", "other"],
           "contract": ["b2b", "uop", "other"]}


@dataclass
class FeatureSet:
    matrix: pd.DataFrame          # one row per offer, every model column plus offer_id and target
    columns: list[str]            # model input columns in order
    skills: list[str]             # skill vocabulary, same order as the skill block of the matrix
    scaler: StandardScaler
    skill_sparse: sparse.csr_matrix


def skill_vocabulary(df: pd.DataFrame) -> list[str]:
    counts = df["skills"].explode().value_counts()
    return counts[counts >= MIN_SKILL_COUNT].head(TOP_SKILLS).index.tolist()


def build_features(df: pd.DataFrame) -> FeatureSet:
    # [onehot-encode] binaries stay 0/1 so each Ridge weight reads as PLN per month; only continuous columns are scaled
    df = df.reset_index(drop=True)
    skills = skill_vocabulary(df)
    position = {s: i for i, s in enumerate(skills)}
    rows, cols = [], []
    for r, offer_skills in enumerate(df["skills"]):
        for s in offer_skills:
            if s in position:
                rows.append(r)
                cols.append(position[s])
    skill_sparse = sparse.csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)), shape=(len(df), len(skills)))

    blocks = [pd.DataFrame(skill_sparse.toarray().astype(np.int8), columns=[f"skill__{s}" for s in skills])]
    for field, levels in ONE_HOT.items():
        blocks.append(pd.DataFrame({f"{field}__{lv}": (df[field] == lv).astype(np.int8) for lv in levels}))
    blocks.append(pd.DataFrame({"remote": df["region"].eq("zdalnie").astype(np.int8)}))

    numeric = pd.DataFrame({"gus_wage": df["gus_wage"], "n_skills": df["skills"].map(len),
                            "seniority_rank": df["seniority_rank"]}).astype(float)
    scaler = StandardScaler().fit(numeric[NUMERIC])
    blocks.append(pd.DataFrame(scaler.transform(numeric[NUMERIC]), columns=[f"{c}__z" for c in NUMERIC]))

    features = pd.concat(blocks, axis=1)
    matrix = pd.concat([df[["offer_id", "source", "salary_pln_month", "is_imputed"]], features], axis=1)
    return FeatureSet(matrix, list(features.columns), skills, scaler, skill_sparse)


def cooccurrence(fs: FeatureSet, salary: np.ndarray) -> pd.DataFrame:
    # [cooccur-matrix] X.T @ X on the sparse skill matrix: diagonal is demand, off-diagonal counts shared offers
    x = fs.skill_sparse
    counts = (x.T @ x).toarray()
    salary_sum = (x.T @ x.multiply(salary[:, None]).tocsr()).toarray()
    n = x.shape[0]
    freq = np.diag(counts)
    out = []
    for i, a in enumerate(fs.skills):
        for j, b in enumerate(fs.skills):
            c = counts[i, j]
            if c == 0:
                continue
            union = freq[i] + freq[j] - c
            out.append({
                "skill_a": a, "skill_b": b, "count": int(c),
                "jaccard": round(float(c / union), 4) if union else 0.0,
                # Lift above 1 means the pair appears together more often than independent demand would predict.
                "lift": round(float(c * n / (freq[i] * freq[j])), 3),
                "mean_salary": round(float(salary_sum[i, j] / c), 0),
            })
    return pd.DataFrame(out)


def skill_stats(df: pd.DataFrame, skills: list[str]) -> pd.DataFrame:
    exploded = df[["offer_id", "skills", "salary_pln_month", "is_imputed", "region"]].explode("skills")
    exploded = exploded[exploded["skills"].isin(skills)]
    observed = exploded[exploded["is_imputed"] == 0]
    grouped = observed.groupby("skills")["salary_pln_month"]
    stats = pd.DataFrame({
        "demand": exploded.groupby("skills").size(),
        "median_salary": grouped.median().round(0),
        "p25": grouped.quantile(0.25).round(0),
        "p75": grouped.quantile(0.75).round(0),
        "podkarpackie_demand": exploded[exploded["region"] == "podkarpackie"].groupby("skills").size(),
    }).fillna({"podkarpackie_demand": 0})
    stats["share"] = (stats["demand"] / len(df)).round(4)
    return stats.reset_index(names="skill")


HEATMAP_CLUSTERS = 8


def heatmap_order(cooccur: pd.DataFrame, skills: list[str]) -> tuple[dict[str, int], dict[str, int]]:
    """Average-linkage clustering on 1 - Jaccard puts skills that travel together next to each other on the heatmap.

    Returns the leaf order and a flat cut of the same tree; leaves of one cluster are contiguous, so the UI can draw seams.
    """
    idx = {s: i for i, s in enumerate(skills)}
    dist = np.ones((len(skills), len(skills)))
    for row in cooccur.itertuples(index=False):
        dist[idx[row.skill_a], idx[row.skill_b]] = 1.0 - row.jaccard
    np.fill_diagonal(dist, 0.0)
    dist = (dist + dist.T) / 2
    tree = linkage(squareform(dist, checks=False), method="average")
    order = leaves_list(tree)
    clusters = fcluster(tree, t=HEATMAP_CLUSTERS, criterion="maxclust")
    return {skills[i]: rank for rank, i in enumerate(order)}, {s: int(c) for s, c in zip(skills, clusters)}
