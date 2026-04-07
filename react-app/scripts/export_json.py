"""
Export ETF CSV data to compact JSON for the React PWA.
Run from the react-app/ directory:
    cd /Users/steven/Documents/ETF
    .venv/bin/python react-app/scripts/export_json.py
"""
import json
import os
import sys

import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'src', 'data')

SYMBOLS = ['0050', '00631L', 'QQQ', 'QQQM']

os.makedirs(OUT_DIR, exist_ok=True)

for sym in SYMBOLS:
    csv_path = os.path.join(DATA_DIR, f'{sym}.csv')
    if not os.path.exists(csv_path):
        print(f'WARN: {csv_path} not found, skipping', file=sys.stderr)
        continue
    df = pd.read_csv(csv_path)
    df['Date'] = pd.to_datetime(df['Date'].astype(str).str[:10])
    df = df.sort_values('Date')
    # Export only Date and Adj Close as compact [[date, adjClose], ...]
    records = [
        [row['Date'].strftime('%Y-%m-%d'), round(float(row['Adj Close']), 6)]
        for _, row in df.iterrows()
        if pd.notna(row['Adj Close']) and float(row['Adj Close']) > 0
    ]
    out_path = os.path.join(OUT_DIR, f'{sym}.json')
    with open(out_path, 'w') as f:
        json.dump(records, f, separators=(',', ':'))
    print(f'{sym}: {len(records)} rows → {out_path}')

# Export splits
splits: dict = {}
for sym in SYMBOLS:
    csv_path = os.path.join(DATA_DIR, f'{sym}_splits.csv')
    if not os.path.exists(csv_path):
        splits[sym] = []
        continue
    df = pd.read_csv(csv_path)
    if df.empty:
        splits[sym] = []
    else:
        splits[sym] = [
            {'date': str(row['Date'])[:10], 'ratio': float(row['SplitRatio'])}
            for _, row in df.iterrows()
        ]

with open(os.path.join(OUT_DIR, 'splits.json'), 'w') as f:
    json.dump(splits, f, indent=2)
print(f'splits → {os.path.join(OUT_DIR, "splits.json")}')

# Write meta with last update timestamp
import datetime
meta = {
    'updated': datetime.date.today().isoformat(),
}
with open(os.path.join(OUT_DIR, 'meta.json'), 'w') as f:
    json.dump(meta, f)
print(f'meta → {os.path.join(OUT_DIR, "meta.json")}')
