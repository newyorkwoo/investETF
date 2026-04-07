import type { AppData, BacktestResult } from '../lib/types';
import { ETF_ORDER, ETF_META, type EtfSymbol } from '../lib/etfMeta';

interface Props {
  appData: AppData;
  selected: Set<string>;
  onToggle: (sym: string) => void;
}

export function ETFSelector({ appData, selected, onToggle }: Props) {
  return (
    <div className="etf-grid">
      {ETF_ORDER.map(sym => {
        const isSelected = selected.has(sym);
        const meta = ETF_META[sym as EtfSymbol];
        const etf = appData.etfs[sym];
        const since = etf ? etf.firstDate.slice(0, 7) : 'N/A';
        return (
          <button
            key={sym}
            className={`etf-card etf-card--${sym.toLowerCase().replace('00631l', 'l2')} ${isSelected ? 'etf-card--selected' : ''}`}
            onClick={() => onToggle(sym)}
            style={isSelected ? { borderColor: meta.color, color: meta.color } : {}}
          >
            <div className="etf-card__check">{isSelected ? '✓ ' : ''}<span className="etf-card__sym">{sym}</span></div>
            <div className="etf-card__name">{meta.name}</div>
            <div className="etf-card__since">since {since}</div>
          </button>
        );
      })}
    </div>
  );
}

interface ResultsTableProps {
  results: Record<string, BacktestResult>;
  startMonth: string;
  endMonth: string;
}

export function ResultsTable({ results }: ResultsTableProps) {
  const syms = ETF_ORDER.filter(s => s in results);
  if (syms.length === 0) return null;

  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th>ETF</th>
            <th>實際區間</th>
            <th>總投入</th>
            <th>期末市值</th>
            <th>總報酬</th>
            <th>年化</th>
            <th>最大回撤</th>
            <th>Sharpe</th>
          </tr>
        </thead>
        <tbody>
          {syms.map(sym => {
            const r = results[sym];
            const meta = ETF_META[sym as EtfSymbol];
            return (
              <tr key={sym}>
                <td>
                  <span style={{ color: meta.color, fontWeight: 700 }}>{sym}</span>
                  <span className="tbl-subname"> {meta.name}</span>
                </td>
                <td>{r.effectiveStart.slice(0, 7)} ~ {r.effectiveEnd.slice(0, 7)}</td>
                <td>{fmt(r.totalInvested)}</td>
                <td>{fmt(r.finalValue)}</td>
                <td className={r.totalReturnPct >= 0 ? 'pos' : 'neg'}>{r.totalReturnPct.toFixed(2)}%</td>
                <td className={r.annualizedReturnPct >= 0 ? 'pos' : 'neg'}>{r.annualizedReturnPct.toFixed(2)}%</td>
                <td className="neg">{r.maxDrawdownPct.toFixed(2)}%</td>
                <td>{r.sharpeRatio.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

interface MetricCardsProps {
  results: Record<string, BacktestResult>;
}

export function MetricCards({ results }: MetricCardsProps) {
  const syms = ETF_ORDER.filter(s => s in results);
  if (syms.length === 0) return null;

  return (
    <div className="metric-grid">
      {syms.map(sym => {
        const r = results[sym];
        const meta = ETF_META[sym as EtfSymbol];
        return (
          <div key={sym} className="metric-card" style={{ borderLeftColor: meta.color }}>
            <div className="metric-card__header" style={{ color: meta.color }}>
              <span className="metric-card__sym">{sym}</span>
              <span className="metric-card__name">{meta.name}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">期末市值</span>
              <span className="metric-value">{fmt(r.finalValue)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">年化報酬率</span>
              <span className={`metric-value ${r.annualizedReturnPct >= 0 ? 'pos' : 'neg'}`}>
                {r.annualizedReturnPct.toFixed(2)}%
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">最大回撤</span>
              <span className="metric-value neg">{r.maxDrawdownPct.toFixed(2)}%</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Sharpe</span>
              <span className="metric-value">{r.sharpeRatio.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
