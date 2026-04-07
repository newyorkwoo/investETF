from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
import json

import pandas as pd
import yfinance as yf


DATA_DIR = Path("data")
META_FILE = DATA_DIR / "meta.json"

SUPPORTED_SYMBOLS = {
    "QQQ": "QQQ",
    "QQQM": "QQQM",
    "0050": "0050.TW",
    "00631L": "00631L.TW",
}


@dataclass
class UpdateResult:
    symbol: str
    rows: int
    latest_date: str | None
    status: str


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_meta() -> dict:
    if META_FILE.exists():
        return json.loads(META_FILE.read_text(encoding="utf-8"))
    return {}


def _save_meta(meta: dict) -> None:
    META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def get_local_csv_path(symbol: str) -> Path:
    return DATA_DIR / f"{symbol}.csv"


def load_local_data(symbol: str) -> pd.DataFrame:
    csv_path = get_local_csv_path(symbol)
    if not csv_path.exists():
        raise FileNotFoundError(f"找不到本地資料檔: {csv_path}")

    df = pd.read_csv(csv_path, parse_dates=["Date"])
    df["Date"] = pd.to_datetime(df["Date"].astype(str).str[:10], format="%Y-%m-%d")
    df = df.sort_values("Date").drop_duplicates(subset=["Date"])
    df = df.set_index("Date")
    return df


def _download_history(yf_symbol: str) -> pd.DataFrame:
    # auto_adjust=False to preserve Adj Close for total-return style calculation.
    raw = yf.download(
        yf_symbol,
        period="max",
        interval="1d",
        auto_adjust=False,
        progress=False,
    )

    if raw.empty:
        raise ValueError(f"無法下載 {yf_symbol} 的歷史資料")

    # yfinance >= 1.x returns MultiIndex columns: (Price, Ticker)
    # Flatten to single-level by taking only the first level (Price).
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = [col[0] for col in raw.columns]

    # Ensure we have Adj Close; fallback to Close
    if "Adj Close" not in raw.columns:
        raw["Adj Close"] = raw["Close"]

    df = raw[["Open", "High", "Low", "Close", "Adj Close", "Volume"]].copy()

    # The index is a DatetimeIndex named "Date" — reset to column
    df = df.reset_index()
    df.rename(columns={df.columns[0]: "Date"}, inplace=True)
    # Normalize to naive date-only (no time, no tz) with consistent ns resolution
    df["Date"] = pd.to_datetime(df["Date"].astype(str).str[:10], format="%Y-%m-%d")
    return df


def _fix_unrecorded_splits(
    df: pd.DataFrame, threshold: float = 0.45
) -> tuple[pd.DataFrame, list[tuple[pd.Timestamp, int]]]:
    """
    Detect & retroactively fix price discontinuities caused by stock/ETF splits
    that are NOT recorded in yfinance's splits database (e.g. 0050 4:1 split 2014).

    A forward N:1 split drops the share price by ~(1-1/N).  We detect any single-day
    drop > threshold (default 45%) whose ratio is within 20% of an integer ≥ 2,
    then divide all earlier prices by that integer to produce a continuous series.

    Returns (corrected_df, [(split_date, split_ratio), ...]).
    """
    detected: list[tuple[pd.Timestamp, int]] = []
    if df.empty:
        return df, detected

    df = df.sort_values("Date").reset_index(drop=True).copy()
    ref_col = "Adj Close" if "Adj Close" in df.columns else "Close"
    price_cols = [c for c in ("Open", "High", "Low", "Close", "Adj Close") if c in df.columns]
    prices = df[ref_col].values.astype(float)

    for i in range(1, len(prices)):
        if prices[i] <= 0 or pd.isna(prices[i]) or pd.isna(prices[i - 1]):
            continue
        fwd_ratio = prices[i - 1] / prices[i]        # >1 → price dropped
        if fwd_ratio < (1.0 + threshold):
            continue
        split_ratio = round(fwd_ratio)
        if split_ratio < 2 or abs(fwd_ratio / split_ratio - 1.0) > 0.20:
            continue                                  # not close to an integer ratio

        # Use EXACT ratio for price adjustment (preserves continuity for non-integer ETF splits).
        # Rounded integer is only for the human-readable label stored in splits CSV.
        exact_ratio = fwd_ratio
        detected.append((df.loc[i, "Date"], split_ratio))
        mask = df.index < i
        for col in price_cols:
            df.loc[mask, col] = df.loc[mask, col] / exact_ratio
        if "Volume" in df.columns:
            df.loc[mask, "Volume"] = (df.loc[mask, "Volume"] * exact_ratio).round().astype("int64")
        prices[:i] /= exact_ratio                    # keep array in sync for chained splits

    return df, detected


def _save_splits(
    symbol: str,
    yf_symbol: str,
    extra: list[tuple[pd.Timestamp, int]] | None = None,
) -> None:
    """Download and cache split / reverse-split history, merging yfinance + detected splits."""
    try:
        splits = yf.Ticker(yf_symbol).splits
        splits_path = DATA_DIR / f"{symbol}_splits.csv"
        records: list[dict] = []
        if splits is not None and not splits.empty:
            sdf = splits.reset_index()
            sdf.columns = ["Date", "SplitRatio"]
            sdf["Date"] = pd.to_datetime(sdf["Date"]).dt.tz_localize(None)
            records.extend(sdf.to_dict("records"))
        if extra:
            existing_dates = {r["Date"] for r in records}
            for dt, ratio in extra:
                ts = pd.Timestamp(dt)
                if ts not in existing_dates:
                    records.append({"Date": ts, "SplitRatio": float(ratio)})
        out = pd.DataFrame(records if records else {"Date": [], "SplitRatio": []},
                           columns=["Date", "SplitRatio"])
        out = out.sort_values("Date").drop_duplicates(subset=["Date"])
        out.to_csv(splits_path, index=False, encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass  # split data is optional; do not fail the main update


def load_splits(symbol: str) -> pd.DataFrame:
    """Return cached split data: columns [Date, SplitRatio]."""
    splits_path = DATA_DIR / f"{symbol}_splits.csv"
    if not splits_path.exists():
        return pd.DataFrame(columns=["Date", "SplitRatio"])
    try:
        df = pd.read_csv(splits_path, parse_dates=["Date"])
        df["Date"] = pd.to_datetime(df["Date"].astype(str).str[:10], format="%Y-%m-%d")
        return df
    except Exception:  # noqa: BLE001
        return pd.DataFrame(columns=["Date", "SplitRatio"])


def update_symbol_data(symbol: str) -> UpdateResult:
    if symbol not in SUPPORTED_SYMBOLS:
        raise ValueError(f"不支援的ETF代碼: {symbol}")

    _ensure_data_dir()
    yf_symbol = SUPPORTED_SYMBOLS[symbol]
    df_raw = _download_history(yf_symbol)
    # Detect & correct price gaps from splits not recorded in yfinance
    df_new, detected_splits = _fix_unrecorded_splits(df_raw)
    csv_path = get_local_csv_path(symbol)

    if csv_path.exists():
        df_old = pd.read_csv(csv_path)
        # Normalize Date dtype to match df_new before merging (pandas 3 dtype issue)
        df_old["Date"] = pd.to_datetime(df_old["Date"].astype(str).str[:10], format="%Y-%m-%d")
        # df_new is authoritative; keep old rows only for dates NOT covered by new download
        new_dates = set(df_new["Date"])
        df_old_extra = df_old[~df_old["Date"].isin(new_dates)]
        merged = pd.concat([df_new, df_old_extra], ignore_index=True)
        merged = merged.sort_values("Date").reset_index(drop=True)
    else:
        merged = df_new.sort_values("Date").reset_index(drop=True)

    merged.to_csv(csv_path, index=False, encoding="utf-8")
    _save_splits(symbol, yf_symbol, extra=detected_splits)   # include auto-detected splits
    latest = merged["Date"].max()

    return UpdateResult(
        symbol=symbol,
        rows=len(merged),
        latest_date=latest.strftime("%Y-%m-%d") if pd.notna(latest) else None,
        status="ok",
    )


def update_all_if_needed(force: bool = False) -> list[UpdateResult]:
    _ensure_data_dir()
    meta = _load_meta()
    today_str = date.today().isoformat()
    last_attempt = meta.get("last_update_attempt")

    if not force and last_attempt == today_str:
        return []

    results: list[UpdateResult] = []
    for symbol in SUPPORTED_SYMBOLS:
        try:
            result = update_symbol_data(symbol)
        except Exception as exc:  # noqa: BLE001
            result = UpdateResult(symbol=symbol, rows=0, latest_date=None, status=f"error: {exc}")
        results.append(result)

    meta["last_update_attempt"] = today_str
    meta["supported_symbols"] = list(SUPPORTED_SYMBOLS.keys())
    _save_meta(meta)

    return results
