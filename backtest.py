from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class BacktestResult:
    equity_curve: pd.DataFrame
    total_invested: float
    final_value: float
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float


def _month_end_schedule(index: pd.DatetimeIndex, start: pd.Timestamp, end: pd.Timestamp) -> pd.DatetimeIndex:
    mask = (index >= start) & (index <= end)
    dates = index[mask]
    if dates.empty:
        return dates

    month_groups = pd.Series(dates, index=dates).groupby([dates.year, dates.month])
    month_end_dates = month_groups.max().to_list()
    return pd.DatetimeIndex(month_end_dates)


def run_dca_backtest(
    price_df: pd.DataFrame,
    start_date: str,
    end_date: str,
    initial_amount: float,
    monthly_amount: float,
) -> BacktestResult:
    if "Adj Close" not in price_df.columns:
        raise ValueError("price_df 必須包含 Adj Close 欄位")

    series = price_df["Adj Close"].dropna().copy()
    if series.empty:
        raise ValueError("價格資料為空")

    s = pd.to_datetime(start_date)
    e = pd.to_datetime(end_date)
    if s > e:
        raise ValueError("開始日期不能晚於結束日期")

    if s < series.index.min() or e > series.index.max():
        raise ValueError("所選日期超出可用歷史資料範圍")

    in_range = series[(series.index >= s) & (series.index <= e)]
    if in_range.empty:
        raise ValueError("日期範圍內沒有可用價格資料")

    invest_dates = _month_end_schedule(series.index, s, e)
    if invest_dates.empty:
        raise ValueError("此區間沒有可投資交易日")

    shares = 0.0
    invested = 0.0
    records: list[dict] = []

    first_trade_date = invest_dates.min()

    for dt in in_range.index:
        price = float(in_range.loc[dt])

        if dt == first_trade_date and initial_amount > 0:
            buy_shares = initial_amount / price
            shares += buy_shares
            invested += initial_amount

        if dt in invest_dates and monthly_amount > 0:
            buy_shares = monthly_amount / price
            shares += buy_shares
            invested += monthly_amount

        value = shares * price
        records.append(
            {
                "Date": dt,
                "Price": price,
                "Shares": shares,
                "Invested": invested,
                "PortfolioValue": value,
            }
        )

    equity = pd.DataFrame(records).set_index("Date")

    final_value = float(equity["PortfolioValue"].iloc[-1])
    total_invested = float(equity["Invested"].iloc[-1])

    if total_invested <= 0:
        raise ValueError("投入金額必須大於 0")

    total_return_pct = (final_value / total_invested - 1.0) * 100.0

    days = (equity.index[-1] - equity.index[0]).days
    years = max(days / 365.25, 1 / 365.25)
    annualized_return_pct = ((final_value / total_invested) ** (1 / years) - 1.0) * 100.0

    rolling_max = equity["PortfolioValue"].cummax()
    drawdown = equity["PortfolioValue"] / rolling_max - 1.0
    max_drawdown_pct = float(drawdown.min() * 100.0)

    daily_ret = equity["PortfolioValue"].pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    std = float(daily_ret.std(ddof=1)) if len(daily_ret) > 1 else 0.0
    if std > 0:
        sharpe = float((daily_ret.mean() / std) * np.sqrt(252))
    else:
        sharpe = 0.0

    return BacktestResult(
        equity_curve=equity,
        total_invested=total_invested,
        final_value=final_value,
        total_return_pct=total_return_pct,
        annualized_return_pct=annualized_return_pct,
        max_drawdown_pct=max_drawdown_pct,
        sharpe_ratio=sharpe,
    )
