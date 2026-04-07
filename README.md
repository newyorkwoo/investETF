# ETF 投資試算工具

使用真實歷史價格資料下載並保存於本地端，支援 `QQQ`、`QQQM`、`0050`、`00631L` 的定期定額回測。

## 功能

- 首次啟動自動下載歷史資料並儲存到 `data/` 資料夾
- 每天首次啟動時自動更新當天資料（同一天只嘗試更新一次）
- 可手動強制更新資料
- 回測指標：
  - 總投入
  - 期末市值
  - 總報酬率
  - 年化報酬率
  - 最大回撤
  - Sharpe Ratio

## 安裝與啟動

```bash
cd /Users/steven/Documents/ETF
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## 本地資料儲存

- 價格資料：`data/QQQ.csv`、`data/QQQM.csv`、`data/0050.csv`、`data/00631L.csv`
- 更新紀錄：`data/meta.json`

## 資料來源

- 透過 `yfinance` 下載 Yahoo Finance 歷史資料
- 台股代號對應：
  - `0050 -> 0050.TW`
  - `00631L -> 00631L.TW`
