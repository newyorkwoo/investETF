import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import type { BacktestResult, SplitsData } from '../lib/types';
import { ETF_ORDER, ETF_META, type EtfSymbol } from '../lib/etfMeta';
import { downsample } from '../lib/data';
import { useState } from 'react';

const MAX_CHART_POINTS = 600;

interface Props {
  results: Record<string, BacktestResult>;
  splits: SplitsData;
}

type ChartTab = 'value' | 'return' | 'drawdown';

// Merge records from multiple ETFs into a single array keyed by date
function buildChartData(
  results: Record<string, BacktestResult>,
  tab: ChartTab,
): Record<string, number | string>[] {
  const syms = ETF_ORDER.filter(s => s in results);
  if (syms.length === 0) return [];

  // Collect all dates from all ETFs
  const dateSet = new Set<string>();
  for (const sym of syms) {
    // Downsample per ETF before merging
    const sampled = downsample(results[sym].records, MAX_CHART_POINTS);
    for (const r of sampled) dateSet.add(r.date);
  }
  const dates = [...dateSet].sort();

  // Build lookup maps
  const lookup: Record<string, Map<string, number>> = {};
  for (const sym of syms) {
    const map = new Map<string, number>();
    const sampled = downsample(results[sym].records, MAX_CHART_POINTS);
    for (const r of sampled) {
      const val = tab === 'value'    ? r.portfolioValue
                : tab === 'return'   ? r.returnPct
                : r.drawdownPct;
      map.set(r.date, val);
    }
    lookup[sym] = map;
  }

  // For 'value' chart, also include the invested curve (use first ETF's invested)
  let investedMap: Map<string, number> | null = null;
  if (tab === 'value') {
    investedMap = new Map<string, number>();
    const sampled = downsample(results[syms[0]].records, MAX_CHART_POINTS);
    for (const r of sampled) investedMap.set(r.date, r.invested);
  }

  return dates.map(date => {
    const row: Record<string, number | string> = { date };
    for (const sym of syms) {
      const v = lookup[sym].get(date);
      if (v !== undefined) row[sym] = v;
    }
    if (investedMap) {
      const iv = investedMap.get(date);
      if (iv !== undefined) row['__invested'] = iv;
    }
    return row;
  });
}

function fmtDate(d: string): string {
  return d.slice(0, 7); // YYYY-MM
}

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return v.toFixed(0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, tab }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__date">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => {
        if (p.name === '__invested') return null;
        let valStr = '';
        if (tab === 'value')    valStr = p.value.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
        if (tab === 'return')   valStr = p.value.toFixed(1) + '%';
        if (tab === 'drawdown') valStr = p.value.toFixed(1) + '%';
        return (
          <div key={p.name} className="chart-tooltip__row" style={{ color: p.color }}>
            <span>{p.name}</span><span>{valStr}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ChartPanel({ results, splits }: Props) {
  const [tab, setTab] = useState<ChartTab>('value');
  const syms = ETF_ORDER.filter(s => s in results);
  if (syms.length === 0) return null;

  const chartData = buildChartData(results, tab);

  // Collect split reference lines within any ETF's effective range
  const splitLines: { date: string; label: string; color: string }[] = [];
  for (const sym of syms) {
    const efStart = results[sym].effectiveStart;
    const efEnd   = results[sym].effectiveEnd;
    const color   = ETF_META[sym as EtfSymbol].color;
    for (const sp of (splits[sym] ?? [])) {
      if (sp.date >= efStart && sp.date <= efEnd) {
        const label = sp.ratio >= 1
          ? `${sym} ${sp.ratio.toFixed(0)}:1 分割`
          : `${sym} 1:${Math.round(1 / sp.ratio)} 反向`;
        splitLines.push({ date: sp.date, label, color });
      }
    }
  }

  const TABS: { key: ChartTab; label: string }[] = [
    { key: 'value',    label: '市值' },
    { key: 'return',   label: '投報率' },
    { key: 'drawdown', label: '回撤' },
  ];

  const yFormatter = tab === 'value'    ? fmtValue
                   : (v: number) => v.toFixed(0) + '%';

  return (
    <div className="chart-panel">
      <div className="chart-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`chart-tab ${tab === t.key ? 'chart-tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="chart-title">
        {tab === 'value'    && '投資組合市值比較'}
        {tab === 'return'   && '投報率成長比較（市值 / 投入 × 100）'}
        {tab === 'drawdown' && '回撤比較'}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: '#aaa', fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={yFormatter}
            tick={{ fill: '#aaa', fontSize: 10 }}
            width={50}
          />
          <Tooltip content={<CustomTooltip tab={tab} />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value) => {
              if (value === '__invested') return '累計投入';
              const m = ETF_META[value as EtfSymbol];
              return m ? `${value} ${m.name}` : value;
            }}
          />

          {/* Reference lines for splits */}
          {splitLines.map(sp => (
            <ReferenceLine
              key={`${sp.date}-${sp.label}`}
              x={sp.date}
              stroke={sp.color}
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{ value: sp.label, fill: sp.color, fontSize: 8, angle: -90, position: 'insideTopLeft' }}
            />
          ))}

          {/* Invested baseline for value chart */}
          {tab === 'value' && (
            <Line
              dataKey="__invested"
              name="__invested"
              stroke="#666"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
            />
          )}

          {/* Reference line at 100 for return chart */}
          {tab === 'return' && (
            <ReferenceLine y={100} stroke="#555" strokeDasharray="4 3" label={{ value: '成本線', fill: '#777', fontSize: 9 }} />
          )}

          {/* ETF lines */}
          {syms.map(sym => (
            <Line
              key={sym}
              dataKey={sym}
              name={sym}
              stroke={ETF_META[sym as EtfSymbol].color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
