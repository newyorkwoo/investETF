import { useState, useCallback } from 'react';
import type { BacktestResult } from './lib/types';
import { getAppData, buildMonthOptions, monthToStartDate, monthToEndDate } from './lib/data';

// Data is bundled statically — always available synchronously, zero network needed
const APP_DATA = getAppData();
const ALL_MONTHS = buildMonthOptions(APP_DATA.etfs, Object.keys(APP_DATA.etfs));
import { runDcaBacktest } from './lib/backtest';
import { ETF_ORDER, ETF_META, PRESETS, type EtfSymbol } from './lib/etfMeta';
import { ETFSelector, ResultsTable, MetricCards } from './components/Results';
import { ChartPanel } from './components/ChartPanel';

export default function App() {
  const [selected, setSelected]     = useState<Set<string>>(new Set(['0050', 'QQQ']));
  const [monthlyAmt, setMonthlyAmt] = useState(30000);
  const [inputAmt, setInputAmt]     = useState('30000');
  const [startMonth, setStartMonth] = useState(ALL_MONTHS[0] ?? '');
  const [endMonth, setEndMonth]     = useState(ALL_MONTHS[ALL_MONTHS.length - 1] ?? '');
  const [results, setResults]       = useState<Record<string, BacktestResult> | null>(null);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [showDetail, setShowDetail] = useState(false);

  const monthOptions = buildMonthOptions(APP_DATA.etfs, [...selected]);

  const toggleEtf = useCallback((sym: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sym)) {
        if (next.size > 1) next.delete(sym);
      } else {
        next.add(sym);
      }
      return next;
    });
    setResults(null);
  }, []);

  const handleCalculate = useCallback(() => {
    if (!startMonth || !endMonth) return;
    const newResults: Record<string, BacktestResult> = {};
    const newErrors: Record<string, string> = {};

    for (const sym of [...selected]) {
      const etf = APP_DATA.etfs[sym];
      if (!etf) { newErrors[sym] = '無資料'; continue; }
      try {
        newResults[sym] = runDcaBacktest(
          etf.prices,
          monthToStartDate(startMonth),
          monthToEndDate(endMonth),
          monthlyAmt,
        );
      } catch (e) {
        newErrors[sym] = String(e);
      }
    }
    setResults(newResults);
    setErrors(newErrors);
  }, [selected, startMonth, endMonth, monthlyAmt]);

  const handleAmtInput = (v: string) => {
    setInputAmt(v);
    const n = parseInt(v.replace(/,/g, ''), 10);
    if (!isNaN(n) && n >= 0) setMonthlyAmt(n);
  };

  return (
    <div className="app">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="app-header">
        <h1 className="app-title">ETF 定期定額試算</h1>
        <p className="app-sub">Yahoo Finance 真實歷史數據　資料日期：{APP_DATA.updatedDate}</p>
      </header>

      <main className="app-main">
        {/* ── ETF Selection ────────────────────────────────── */}
        <section className="section">
          <div className="section-label">選擇 ETF（可多選）</div>
          <ETFSelector appData={APP_DATA} selected={selected} onToggle={toggleEtf} />
        </section>

        <div className="divider" />

        {/* ── Input Parameters ─────────────────────────────── */}
        <section className="section">
          <div className="section-label">每月投入 TWD</div>
          <div className="amt-row">
            <button className="amt-step" onClick={() => { const v = Math.max(0, monthlyAmt - 1000); setMonthlyAmt(v); setInputAmt(String(v)); }}>−</button>
            <input
              className="amt-input"
              type="number"
              inputMode="numeric"
              value={inputAmt}
              onChange={e => handleAmtInput(e.target.value)}
              onBlur={() => setInputAmt(String(monthlyAmt))}
              min={0}
            />
            <button className="amt-step" onClick={() => { const v = monthlyAmt + 1000; setMonthlyAmt(v); setInputAmt(String(v)); }}>＋</button>
          </div>
          <div className="presets">
            {PRESETS.map(([label, val]) => (
              <button
                key={label}
                className={`preset-btn ${monthlyAmt === val ? 'preset-btn--active' : ''}`}
                onClick={() => { setMonthlyAmt(val); setInputAmt(String(val)); }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="section month-section">
          <div className="month-col">
            <div className="section-label">開始月份</div>
            <select
              className="month-select"
              value={startMonth}
              onChange={e => { setStartMonth(e.target.value); setResults(null); }}
            >
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="month-col">
            <div className="section-label">結束月份</div>
            <select
              className="month-select"
              value={endMonth}
              onChange={e => { setEndMonth(e.target.value); setResults(null); }}
            >
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </section>

        <div className="btn-row">
          <button className="btn-primary" onClick={handleCalculate}>▶ 開始試算</button>
        </div>

        {/* ── Errors ───────────────────────────────────────── */}
        {Object.entries(errors).map(([sym, msg]) => (
          <div key={sym} className="error-banner">{sym}：{msg}</div>
        ))}

        {/* ── Results ──────────────────────────────────────── */}
        {results && Object.keys(results).length > 0 && (
          <>
            <div className="divider" />

            <div className="info-box">
              <strong>計算方法：</strong>採用除權息調整後收盤價（Adj Close），含股息再投入的總報酬試算。圖中虛線標示分割事件。
            </div>

            <section className="section">
              <div className="section-label">比較指標</div>
              <MetricCards results={results} />
            </section>

            <section className="section">
              <ResultsTable results={results} startMonth={startMonth} endMonth={endMonth} />
            </section>

            <div className="divider" />

            <ChartPanel results={results} splits={APP_DATA.splits} />

            {/* ── Detail Data ────────────────────────────────── */}
            <div className="divider" />
            <button
              className="detail-toggle"
              onClick={() => setShowDetail(v => !v)}
            >
              {showDetail ? '▲' : '▼'} 明細資料（最近 60 筆）
            </button>
            {showDetail && (
              <div className="detail-section">
                {ETF_ORDER.filter(s => s in results).map(sym => (
                  <div key={sym} className="detail-etf">
                    <div className="detail-etf__title" style={{ color: ETF_META[sym as EtfSymbol].color }}>
                      {sym} {ETF_META[sym as EtfSymbol].name}
                    </div>
                    <div className="detail-scroll">
                      <table className="detail-table">
                        <thead>
                          <tr><th>日期</th><th>價格</th><th>累積股數</th><th>累計投入</th><th>市值</th><th>投報率</th></tr>
                        </thead>
                        <tbody>
                          {results[sym].records.slice(-60).reverse().map(r => (
                            <tr key={r.date}>
                              <td>{r.date}</td>
                              <td>{r.price.toFixed(2)}</td>
                              <td>{r.shares.toFixed(4)}</td>
                              <td>{r.invested.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                              <td>{r.portfolioValue.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</td>
                              <td className={r.returnPct >= 0 ? 'pos' : 'neg'}>{r.returnPct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>資料來源：Yahoo Finance　僅供學習參考，非投資建議</p>
      </footer>
    </div>
  );
}
