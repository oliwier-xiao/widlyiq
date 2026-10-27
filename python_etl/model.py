"""Model stage: RidgeCV salary model, portal bias from residuals, and the Matplotlib diagnostic chart."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from sklearn.linear_model import RidgeCV  # noqa: E402
from sklearn.metrics import mean_absolute_error, r2_score  # noqa: E402
from sklearn.model_selection import KFold, cross_val_predict, train_test_split  # noqa: E402

from python_etl.features import NUMERIC, FeatureSet  # noqa: E402

ALPHAS = np.logspace(-1, 4, 40)
SEED = 7
FONT_PATH = Path(__file__).resolve().parent / "assets" / "fonts" / "Archivo-Variable.ttf"
INK, ORANGE, GREY, RED, PAPER = "#0F1110", "#FF5B1A", "#8B908A", "#C21F17", "#FFFFFF"


def _feature_group(column: str) -> str:
    return column.split("__", 1)[0] if "__" in column else column


def train_ridge(fs: FeatureSet) -> tuple[pd.DataFrame, dict]:
    # [ml-ridge] RidgeCV picks the penalty by cross-validation; the shrinkage keeps rare skills from inventing premiums
    observed = fs.matrix[fs.matrix["is_imputed"] == 0]
    x, y = observed[fs.columns].to_numpy(dtype=float), observed["salary_pln_month"].to_numpy(dtype=float)
    x_tr, x_te, y_tr, y_te = train_test_split(x, y, test_size=0.2, random_state=SEED)
    holdout = RidgeCV(alphas=ALPHAS, cv=5).fit(x_tr, y_tr)
    pred = holdout.predict(x_te)
    model = RidgeCV(alphas=ALPHAS, cv=5).fit(x, y)

    means = dict(zip([f"{c}__z" for c in NUMERIC], fs.scaler.mean_))
    scales = dict(zip([f"{c}__z" for c in NUMERIC], fs.scaler.scale_))
    weights = pd.DataFrame({
        "feature": fs.columns,
        "label": [c.split("__", 1)[1] if "__" in c and not c.endswith("__z") else c.removesuffix("__z") for c in fs.columns],
        "feature_group": [_feature_group(c) if not c.endswith("__z") else "numeric" for c in fs.columns],
        "weight": np.round(model.coef_, 2),
        "scaler_mean": [means.get(c) for c in fs.columns],
        "scaler_scale": [scales.get(c) for c in fs.columns],
        "support": observed[fs.columns].astype(bool).sum().to_numpy(),
    })
    weights = pd.concat([pd.DataFrame([{"feature": "__intercept__", "label": "intercept", "feature_group": "intercept",
                                        "weight": round(float(model.intercept_), 2), "support": len(observed)}]), weights],
                        ignore_index=True)
    weights["abs_rank"] = weights["weight"].abs().rank(ascending=False, method="first").astype(int)
    metrics = {
        "alpha": float(model.alpha_), "r2_test": round(float(r2_score(y_te, pred)), 3),
        "mae_test": round(float(mean_absolute_error(y_te, pred)), 0), "n_train": int(len(x_tr)),
        "n_test": int(len(x_te)), "n_features": len(fs.columns),
    }
    return weights, metrics


def ground_truth_check(weights: pd.DataFrame, truth_path: Path) -> dict | None:
    """On synthetic snapshots the generating premiums are known, so the fit can be scored against them."""
    if not truth_path.exists():
        return None
    truth = json.loads(truth_path.read_text(encoding="utf-8"))["skill_premium_pln"]
    est = weights[weights["feature_group"] == "skill"].set_index("label")["weight"]
    shared = [s for s in est.index if s in truth]
    if len(shared) < 5:
        return None
    r = float(np.corrcoef(est[shared], [truth[s] for s in shared])[0, 1])
    return {"pearson_r": round(r, 3), "skills_compared": len(shared)}


def oof_residuals(fs: FeatureSet, alpha: float) -> pd.DataFrame:
    """Relative out-of-fold residual per observed offer, kept per offer so the dashboard can aggregate it under any filter."""
    observed = fs.matrix[fs.matrix["is_imputed"] == 0].reset_index(drop=True)
    x, y = observed[fs.columns].to_numpy(dtype=float), observed["salary_pln_month"].to_numpy(dtype=float)
    pred = cross_val_predict(RidgeCV(alphas=[alpha]), x, y, cv=KFold(5, shuffle=True, random_state=SEED))
    return pd.DataFrame({"offer_id": observed["offer_id"], "source": observed["source"], "cv_residual": (y - pred) / pred})


def portal_bias(residuals: pd.DataFrame) -> pd.DataFrame:
    """Median out-of-fold residual per portal over the whole clean set: what a portal pays above or below the model."""
    out = residuals.groupby("source")["cv_residual"].agg(n="size", median_residual_pct=lambda s: round(float(s.median() * 100), 1))
    return out.reset_index()


def _offers(n: int) -> str:
    few = n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14)
    # Grouped with a no-break space like Intl pl-PL in the dashboard, so the chart and the page print "1 031" alike.
    return f"{n:,}".replace(",", "\u00a0") + f" {'oferta' if n == 1 else 'oferty' if few else 'ofert'}"


def plot_iqr_distribution(clean: pd.DataFrame, rejected: pd.DataFrame, path: Path) -> None:
    # [plot-mpl] diagnostic for the IQR stage: kept offers, Podkarpackie, rejected outliers, on a log salary axis
    # The variable font has no static "normal" instance, so matplotlib logs a harmless fallback warning per call.
    logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
    if FONT_PATH.exists():
        font_manager.fontManager.addfont(str(FONT_PATH))
        family = font_manager.FontProperties(fname=str(FONT_PATH)).get_name()
    else:
        family = "DejaVu Sans"
    plt.rcParams.update({"font.family": family, "svg.fonttype": "path", "svg.hashsalt": "widlyiq",
                         "axes.edgecolor": INK, "axes.labelcolor": INK, "xtick.color": INK, "ytick.color": INK})
    order = ["junior", "mid", "senior", "lead"]
    kept = clean[clean["is_imputed"] == 0]
    out = rejected[rejected["stage"] == "filter-iqr"]

    fig, ax = plt.subplots(figsize=(12, 5.2), dpi=100)
    fig.patch.set_facecolor(PAPER)
    sns.boxplot(data=kept, x="salary_pln_month", y="seniority", order=order, whis=1.5, showfliers=False, width=0.5,
                color="#EEF0EC", linecolor=INK, linewidth=1.1, ax=ax, log_scale=True)
    others = kept[kept["region"] != "podkarpackie"]
    sns.stripplot(data=others, x="salary_pln_month", y="seniority", order=order, color=GREY, size=2.4, alpha=0.55,
                  jitter=0.22, ax=ax)
    sns.stripplot(data=kept[kept["region"] == "podkarpackie"], x="salary_pln_month", y="seniority", order=order,
                  color=ORANGE, size=3.4, jitter=0.22, ax=ax)
    if len(out):
        sns.stripplot(data=out, x="salary_pln_month", y="seniority", order=order, color=RED, size=6, marker="o",
                      linewidth=1.2, edgecolor=RED, facecolor="none", jitter=0.12, ax=ax)

    ax.set_xlabel("Wynagrodzenie, zł / mies. (skala logarytmiczna). Płotki liczone w grupach kategoria × poziom × umowa,"
                  " więc odrzucona oferta może leżeć w pudełku swojego poziomu.", fontsize=10)
    ax.set_ylabel("")
    ax.set_yticks(range(4), ["Junior", "Mid", "Senior", "Lead"], fontsize=11)
    ticks = [3_000, 5_000, 10_000, 20_000, 40_000, 80_000, 200_000, 1_000_000]
    ax.set_xticks(ticks, [f"{t // 1000} tys." if t < 1_000_000 else "1 mln" for t in ticks], fontsize=10)
    ax.minorticks_off()
    ax.grid(axis="x", color="#DADDD6", linewidth=0.8)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    # Imputed offers sit exactly on a group median, so the chart draws only offers that came with a salary range.
    ax.set_title(f"Płotki IQR (k = 1,5, na log) · {_offers(len(kept))} z widełkami · odrzucone {len(out)}",
                 loc="left", fontsize=13, fontweight="bold", color=INK, pad=12)
    handles = [plt.Line2D([], [], marker="o", ls="", color=GREY, label="oferta"),
               plt.Line2D([], [], marker="o", ls="", color=ORANGE, label="Podkarpackie"),
               plt.Line2D([], [], marker="o", ls="", markerfacecolor="none", markeredgecolor=RED, label="odrzucona przez IQR")]
    ax.legend(handles=handles, loc="lower right", frameon=False, fontsize=10)
    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, format="svg", metadata={"Date": None, "Creator": "WidlyIQ python_etl/model.py"})
    plt.close(fig)
