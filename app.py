from __future__ import annotations

from datetime import date

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from backtest import run_dca_backtest
from etf_data import SUPPORTED_SYMBOLS, load_local_data, load_splits, update_all_if_needed

ETF_DISPLAY_ORDER = ["0050", "00631L", "QQQ", "QQQM"]

ETF_META = {
    "0050":   {"name": "元大台灣50",    "label": "0050"},
    "00631L": {"name": "元大台灣50正2", "label": "00631L"},
    "QQQ":    {"name": "Invesco QQQ",  "label": "QQQ"},
    "QQQM":   {"name": "QQQM",         "label": "QQQM"},
}

COLORS = {
    "QQQ":    "#4C9BE8",
    "QQQM":   "#A78BFA",
    "0050":   "#F59E0B",
    "00631L": "#34D399",
}

PRESETS = [("3千", 3000), ("5千", 5000), ("1萬", 10000), ("2萬", 20000), ("3萬", 30000)]

# ═══════════════════════════════════════════════════════
st.set_page_config(page_title="ETF 定期定額試算", page_icon="📈", layout="wide")

# ── CSS 自訂樣式 ──────────────────────────────────────────
st.markdown("""
<style>
/* 隱藏 Streamlit 預設 header 邊距 */
.block-container { padding-top: 1.5rem; }

/* ETF 卡片選擇區 */
.etf-card-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.etf-card {
    border: 2px solid #444;
    border-radius: 10px;
    padding: 10px 18px;
    cursor: pointer;
    background: #1e1e2e;
    color: #ccc;
    min-width: 200px;
    transition: all .15s;
}
.etf-card.selected-0050   { border-color: #F59E0B; color: #F59E0B; }
.etf-card.selected-00631L { border-color: #34D399; color: #34D399; }
.etf-card.selected-QQQ    { border-color: #4C9BE8; color: #4C9BE8; }
.etf-card.selected-QQQM   { border-color: #A78BFA; color: #A78BFA; }
.etf-label  { font-size: 1.1rem; font-weight: 700; }
.etf-name   { font-size: 0.75rem; opacity: .7; margin: 2px 0; }
.etf-since  { font-size: 0.72rem; opacity: .55; }

/* 快速金額按鈕 */
div[data-testid="stHorizontalBlock"] button[kind="secondary"] {
    padding: 2px 10px; font-size: 0.8rem;
}
</style>
""", unsafe_allow_html=True)

# ── 頁首 ──────────────────────────────────────────────────
st.markdown("## ETF  定期定額試算")
st.caption("Digrin.com & Yahoo Finance　真實歷史數據")

# ── 自動更新資料（每日一次）───────────────────────────────
with st.spinner("檢查資料更新..."):
    update_results = update_all_if_needed(force=False)
if update_results:
    with st.expander("今日更新結果", expanded=False):
        for r in update_results:
            st.write(f"- {r.symbol}: {r.status}　rows={r.rows}　latest={r.latest_date}")

# ── 載入本地資料、分割歷史 & since 日期 ──────────────────
all_data: dict[str, pd.DataFrame] = {}
all_splits: dict[str, pd.DataFrame] = {}
etf_since: dict[str, str] = {}
for sym in ETF_DISPLAY_ORDER:
    try:
        df = load_local_data(sym)
        all_data[sym] = df
        etf_since[sym] = df.index.min().strftime("%Y-%m")
    except FileNotFoundError:
        etf_since[sym] = "N/A"
    all_splits[sym] = load_splits(sym)  # may be empty DataFrame if no splits

if not all_data:
    st.error("找不到本地資料，請點「手動強制更新」。")
    if st.button("手動強制更新資料"):
        with st.spinner("下載中..."):
            update_all_if_needed(force=True)
        st.rerun()
    st.stop()

# ── Session state：管理選中的 ETF 與投入金額 ─────────────
if "selected_etfs" not in st.session_state:
    st.session_state.selected_etfs = {"0050", "QQQ"}
if "monthly_input" not in st.session_state:
    st.session_state.monthly_input = 30000

st.divider()

# ── ETF 選擇卡片（多選）──────────────────────────────────
st.markdown("**選擇 ETF（可多選）**")
btn_cols = st.columns(len(ETF_DISPLAY_ORDER))
for col, sym in zip(btn_cols, ETF_DISPLAY_ORDER):
    with col:
        is_sel = sym in st.session_state.selected_etfs
        label_in = f"{'✓ ' if is_sel else ''}{sym}"
        since_str = etf_since.get(sym, "")
        name = ETF_META[sym]["name"]
        btn_label = f"{label_in}\n{name}\nsince {since_str}"
        if st.button(btn_label, key=f"etf_btn_{sym}", use_container_width=True,
                     type="primary" if is_sel else "secondary"):
            if is_sel:
                if len(st.session_state.selected_etfs) > 1:
                    st.session_state.selected_etfs.discard(sym)
            else:
                st.session_state.selected_etfs.add(sym)
            st.rerun()

selected_syms = [s for s in ETF_DISPLAY_ORDER if s in st.session_state.selected_etfs]
selected_data = {s: all_data[s] for s in selected_syms if s in all_data}

if not selected_data:
    st.warning("請至少選擇一檔 ETF。")
    st.stop()

st.divider()

# ── 月份清單（取所有已選ETF各自的最晚「起始」月份到最新）────────────
overall_min_date = max(df.index.min() for df in selected_data.values())
overall_max_date = max(df.index.max() for df in selected_data.values())

def _month_range(start: pd.Timestamp, end: pd.Timestamp) -> list[str]:
    periods = pd.period_range(start=start.to_period("M"), end=end.to_period("M"), freq="M")
    return [str(p) for p in periods]

month_options = _month_range(overall_min_date, overall_max_date)
default_start = str(overall_min_date.to_period("M"))
default_end   = str(overall_max_date.to_period("M"))

# ── 參數輸入列 ────────────────────────────────────────────
row1_c1, row1_c2, row1_c3 = st.columns([2, 2, 3])

with row1_c1:
    monthly_val = st.number_input(
        "每月投入 TWD",
        min_value=0,
        value=st.session_state.monthly_input,
        step=1000,
    )
    st.session_state.monthly_input = int(monthly_val)
    # 快速預設按鈕
    pb = st.columns(len(PRESETS))
    for pcol, (label, val) in zip(pb, PRESETS):
        with pcol:
            if st.button(label, key=f"preset_{val}", use_container_width=True):
                st.session_state.monthly_input = val
                st.rerun()

with row1_c2:
    start_month = st.selectbox(
        "開始月份",
        options=month_options,
        index=month_options.index(default_start) if default_start in month_options else 0,
    )

with row1_c3:
    end_month = st.selectbox(
        "結束月份",
        options=month_options,
        index=len(month_options) - 1,
    )

# 月份字串 → 該月第一/最後交易日
def _month_to_start_date(ym: str) -> str:
    return pd.Period(ym, "M").start_time.strftime("%Y-%m-%d")

def _month_to_end_date(ym: str) -> str:
    return pd.Period(ym, "M").end_time.strftime("%Y-%m-%d")

start_str = _month_to_start_date(start_month)
end_str   = _month_to_end_date(end_month)

# ── 分割標記輔助函式 ─────────────────────────────────────
def _add_split_markers(
    fig: go.Figure,
    splits_by_sym: dict[str, pd.DataFrame],
    eff_dates: dict[str, tuple[str, str]],
) -> None:
    """Add vertical dashed lines at split/reverse-split events within each ETF's backtest window."""
    for sym, sdf in splits_by_sym.items():
        if sdf.empty or sym not in eff_dates:
            continue
        s_start, s_end = eff_dates[sym]
        color = COLORS[sym]
        for _, row in sdf.iterrows():
            dt = pd.to_datetime(row["Date"])
            ratio = float(row["SplitRatio"])
            dt_str = dt.strftime("%Y-%m-%d")
            if not (s_start <= dt_str <= s_end):
                continue
            if ratio >= 1:
                label = f"{sym} {ratio:.0f}:1 分割"
            else:
                label = f"{sym} 1:{round(1 / ratio)} 反向分割"
            fig.add_shape(
                type="line",
                x0=dt_str, x1=dt_str,
                y0=0, y1=1, yref="paper",
                line=dict(dash="dash", color=color, width=1),
            )
            fig.add_annotation(
                x=dt_str, y=0.97, yref="paper",
                text=label, showarrow=False,
                font=dict(size=9, color=color),
                xanchor="left", textangle=-90,
            )


# ── 手動更新 & 試算按鈕 ───────────────────────────────────
bc1, bc2, _ = st.columns([1, 1, 4])
with bc1:
    run_clicked = st.button("▶ 開始試算", type="primary", use_container_width=True)
with bc2:
    if st.button("⟳ 強制更新資料", use_container_width=True):
        with st.spinner("下載中..."):
            update_all_if_needed(force=True)
        st.success("更新完成")
        st.rerun()

st.divider()

# ── 回測計算 ──────────────────────────────────────────────
if run_clicked:
    results: dict[str, object] = {}
    errors:  dict[str, str]   = {}
    eff_dates: dict[str, tuple[str, str]] = {}  # per-ETF effective date range
    for sym, df in selected_data.items():
        try:
            # clamp 到每檔 ETF 自身可用的資料區間
            etf_min = df.index.min().strftime("%Y-%m-%d")
            etf_max = df.index.max().strftime("%Y-%m-%d")
            eff_start = max(start_str, etf_min)
            eff_end   = min(end_str,   etf_max)
            eff_dates[sym] = (eff_start, eff_end)
            results[sym] = run_dca_backtest(
                price_df=df,
                start_date=eff_start,
                end_date=eff_end,
                initial_amount=0.0,
                monthly_amount=float(st.session_state.monthly_input),
            )
        except Exception as exc:  # noqa: BLE001
            errors[sym] = str(exc)

    for sym, msg in errors.items():
        st.error(f"{sym} 試算失敗：{msg}")

    if not results:
        st.stop()

    # 依總報酬率由高到低排序
    sorted_result_syms = sorted(
        [s for s in ETF_DISPLAY_ORDER if s in results],
        key=lambda s: results[s].total_return_pct,
        reverse=True
    )

    # ── 比較指標表 ────────────────────────────────────────
    # ── 計算方法說明 ──────────────────────────────────────
    st.info(
        "**計算方法**：採用除權息調整後收盤價（Adj Close）。"
        "所有歷史收盤價已按股票分割比例等比例回溯調整，確保分割前後股數計算一致；"
        "同時含除息調整，相當於股息全數再投入的總報酬試算。"
        "圖表中虛線標示分割 / 反向分割事件。"
    )

    st.subheader("比較指標")
    rows = []
    for sym in sorted_result_syms:
        if sym not in results:
            continue
        r = results[sym]
        df = selected_data[sym]
        eff_start = max(start_str, df.index.min().strftime("%Y-%m-%d"))[:7]
        eff_end   = min(end_str,   df.index.max().strftime("%Y-%m-%d"))[:7]
        rows.append({
            "ETF": f"{sym}　{ETF_META[sym]['name']}",
            "實際區間": f"{eff_start} ～ {eff_end}",
            "總投入": f"{r.total_invested:,.0f}",
            "期末市值": f"{r.final_value:,.0f}",
            "總報酬率": f"{r.total_return_pct:.2f}%",
            "年化報酬率": f"{r.annualized_return_pct:.2f}%",
            "最大回撤": f"{r.max_drawdown_pct:.2f}%",
            "Sharpe": f"{r.sharpe_ratio:.2f}",
        })
    st.dataframe(pd.DataFrame(rows).set_index("ETF"), use_container_width=True)

    # ── Metric cards ──────────────────────────────────────
    metric_cols = st.columns(len(results))
    for col, sym in zip(metric_cols, sorted_result_syms):
        r = results[sym]
        with col:
            color = COLORS[sym]
            st.markdown(
                f"<div style='border-left:4px solid {color};padding-left:8px'>"
                f"<b style='color:{color}'>{sym}</b><br>"
                f"<span style='font-size:.8rem;opacity:.7'>{ETF_META[sym]['name']}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )
            st.metric("期末市值", f"{r.final_value:,.0f}")
            st.metric("年化報酬率", f"{r.annualized_return_pct:.2f}%")
            st.metric("最大回撤", f"{r.max_drawdown_pct:.2f}%")
            st.metric("Sharpe", f"{r.sharpe_ratio:.2f}")

    st.divider()

    # ── 投資組合市值折線圖 ─────────────────────────────────
    st.subheader("投資組合市值比較")
    fig_value = go.Figure()
    for sym in sorted_result_syms:
        if sym not in results:
            continue
        curve = results[sym].equity_curve
        fig_value.add_trace(go.Scatter(
            x=curve.index, y=curve["PortfolioValue"],
            mode="lines", name=f"{sym} {ETF_META[sym]['name']}",
            line=dict(width=2.5, color=COLORS[sym]),
        ))
    first_curve = next(iter(results.values())).equity_curve
    fig_value.add_trace(go.Scatter(
        x=first_curve.index, y=first_curve["Invested"],
        mode="lines", name="累計投入",
        line=dict(width=1.5, dash="dot", color="#888"),
    ))
    splits_in_range = {s: all_splits.get(s, pd.DataFrame(columns=["Date","SplitRatio"]))
                       for s in selected_syms}
    _add_split_markers(fig_value, splits_in_range, eff_dates)
    fig_value.update_layout(
        xaxis_title="日期", yaxis_title="金額（TWD）",
        template="plotly_dark", height=480,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=10, r=10, t=40, b=40),
    )
    st.plotly_chart(fig_value, use_container_width=True)

    # ── 投報率成長（標準化）───────────────────────────────
    st.subheader("投報率成長比較")
    fig_pct = go.Figure()
    for sym in sorted_result_syms:
        if sym not in results:
            continue
        curve = results[sym].equity_curve
        ratio = curve["PortfolioValue"] / curve["Invested"] * 100
        fig_pct.add_trace(go.Scatter(
            x=curve.index, y=ratio,
            mode="lines", name=f"{sym} {ETF_META[sym]['name']}",
            line=dict(width=2.5, color=COLORS[sym]),
        ))
    fig_pct.add_hline(y=100, line_dash="dot", line_color="#555", annotation_text="成本線")
    _add_split_markers(fig_pct, splits_in_range, eff_dates)
    fig_pct.update_layout(
        xaxis_title="日期", yaxis_title="市值 / 投入 × 100",
        template="plotly_dark", height=420,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=10, r=10, t=40, b=40),
    )
    st.plotly_chart(fig_pct, use_container_width=True)

    # ── 回撤曲線 ──────────────────────────────────────────
    st.subheader("回撤比較")
    fig_dd = go.Figure()
    for sym in sorted_result_syms:
        if sym not in results:
            continue
        curve = results[sym].equity_curve
        rolling_max = curve["PortfolioValue"].cummax()
        drawdown = (curve["PortfolioValue"] / rolling_max - 1) * 100
        fig_dd.add_trace(go.Scatter(
            x=curve.index, y=drawdown,
            mode="lines", name=f"{sym} {ETF_META[sym]['name']}",
            line=dict(width=2, color=COLORS[sym]),
        ))
    _add_split_markers(fig_dd, splits_in_range, eff_dates)
    fig_dd.update_layout(
        xaxis_title="日期", yaxis_title="回撤 %",
        template="plotly_dark", height=380,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=10, r=10, t=40, b=40),
    )
    st.plotly_chart(fig_dd, use_container_width=True)

    # ── 明細資料 ──────────────────────────────────────────
    with st.expander("查看各 ETF 明細資料（最近 120 筆）"):
        # 為避免 Streamlit 前端渲染錯誤 (removeChild)，分頁標籤維持固定順序
        stable_syms = [s for s in ETF_DISPLAY_ORDER if s in results]
        tabs = st.tabs([f"{s} {ETF_META[s]['name']}" for s in stable_syms])
        for tab, sym in zip(tabs, stable_syms):
            with tab:
                st.dataframe(results[sym].equity_curve.tail(120), use_container_width=True)

else:
    st.info("請選擇 ETF、設定月份與每月投入金額後，按「▶ 開始試算」。")
