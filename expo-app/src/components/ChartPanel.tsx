import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import type { BacktestResult, SplitsData } from '../lib/types';
import { ETF_ORDER, ETF_META, type EtfSymbol } from '../lib/etfMeta';
import { downsample } from '../lib/data';
import { colors } from './theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 32;
const CHART_H = 220;
const MAX_PTS = 120;

const TABS = ['市值', '投報率', '年化回報'] as const;
type Tab = (typeof TABS)[number];

interface ChartPanelProps {
  results: Record<string, BacktestResult>;
  splits: SplitsData;
}

export function ChartPanel({ results }: ChartPanelProps) {
  const [tab, setTab] = useState<Tab>('市值');
  const syms = ETF_ORDER.filter(s => s in results);
  if (syms.length === 0) return null;

  const chartConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(79, 163, 209, ${opacity})`,
    labelColor: () => colors.textMuted,
    propsForDots: { r: '0' },
    propsForBackgroundLines: { stroke: colors.border },
  };

  return (
    <View style={styles.panel}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {syms.map(sym => (
          <View key={sym} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ETF_META[sym as EtfSymbol].color }]} />
            <Text style={styles.legendText}>{sym}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tab === '市值' && <PortfolioChart syms={syms} results={results} chartConfig={chartConfig} />}
        {tab === '投報率' && <ReturnRateChart syms={syms} results={results} chartConfig={chartConfig} />}
        {tab === '年化回報' && <AnnualReturnChart syms={syms} results={results} />}
      </ScrollView>
    </View>
  );
}

// ── Portfolio Value Chart ──────────────────────────────────────
function PortfolioChart({ syms, results, chartConfig }: ChartInnerProps) {
  const primary = syms[0];
  const recs = downsample(results[primary].records, MAX_PTS);
  const labels = recs.map((r, i) => i % Math.floor(MAX_PTS / 6) === 0 ? r.date.slice(0, 7) : '');

  const datasets = syms.map(sym => {
    const sampled = syncDates(results[sym].records, recs.map(r => r.date));
    return {
      data: sampled.map(r => r ? r.portfolioValue / 1_000_000 : 0),
      color: (_op: number) => ETF_META[sym as EtfSymbol].color,
      strokeWidth: 2,
    };
  });

  // Also add invested line
  datasets.push({
    data: recs.map(r => r.invested / 1_000_000),
    color: (_op: number) => colors.border,
    strokeWidth: 1.5,
  });

  return (
    <View>
      <Text style={styles.chartTitle}>投資組合市值（百萬）</Text>
      <LineChart
        data={{ labels, datasets }}
        width={CHART_W}
        height={CHART_H}
        chartConfig={chartConfig}
        bezier
        withDots={false}
        withInnerLines={true}
        style={styles.chart}
      />
    </View>
  );
}

// ── Return Rate Chart ──────────────────────────────────────────
function ReturnRateChart({ syms, results, chartConfig }: ChartInnerProps) {
  const primary = syms[0];
  const recs = downsample(results[primary].records, MAX_PTS);
  const labels = recs.map((r, i) => i % Math.floor(MAX_PTS / 6) === 0 ? r.date.slice(0, 7) : '');

  const datasets = syms.map(sym => {
    const sampled = syncDates(results[sym].records, recs.map(r => r.date));
    return {
      data: sampled.map(r => r ? r.returnPct : 0),
      color: (_op: number) => ETF_META[sym as EtfSymbol].color,
      strokeWidth: 2,
    };
  });

  return (
    <View>
      <Text style={styles.chartTitle}>累積投報率（%）</Text>
      <LineChart
        data={{ labels, datasets }}
        width={CHART_W}
        height={CHART_H}
        chartConfig={{ ...chartConfig, decimalPlaces: 1 }}
        bezier
        withDots={false}
        style={styles.chart}
      />
    </View>
  );
}

// ── Annual Return Bar Chart ────────────────────────────────────
function AnnualReturnChart({ syms, results }: { syms: string[]; results: Record<string, BacktestResult> }) {
  // Compute annual returns for first selected ETF (grouped bar not supported well in chart-kit)
  const sym = syms[0];
  const recs = results[sym].records;
  const annuals = computeAnnualReturns(recs);
  const years = Object.keys(annuals).sort();
  const data = years.map(y => annuals[y]);

  const barConfig = {
    backgroundColor: colors.card,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 1,
    color: (_op: number) => ETF_META[sym as EtfSymbol].color,
    labelColor: () => colors.textMuted,
    propsForBackgroundLines: { stroke: colors.border },
  };

  return (
    <View>
      <Text style={styles.chartTitle}>{sym} 各年度報酬率（%）</Text>
      <BarChart
        data={{
          labels: years.map(y => y.slice(2)),
          datasets: [{ data }],
        }}
        width={Math.max(CHART_W, years.length * 28)}
        height={CHART_H}
        chartConfig={barConfig}
        fromZero={false}
        showValuesOnTopOfBars={false}
        style={styles.chart}
        yAxisLabel=""
        yAxisSuffix="%"
      />
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────
interface ChartInnerProps {
  syms: string[];
  results: Record<string, BacktestResult>;
  chartConfig: object;
}

function syncDates(recs: BacktestResult['records'], targetDates: string[]) {
  const map = new Map(recs.map(r => [r.date, r]));
  return targetDates.map(d => map.get(d) ?? null);
}

function computeAnnualReturns(recs: BacktestResult['records']): Record<string, number> {
  const byYear: Record<string, BacktestResult['records'][0][]> = {};
  for (const r of recs) {
    const y = r.date.slice(0, 4);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(r);
  }
  const result: Record<string, number> = {};
  for (const [y, rows] of Object.entries(byYear)) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    const startVal = first.portfolioValue - (first.invested - (rows[0]?.invested ?? 0));
    if (startVal > 0) {
      result[y] = (last.portfolioValue / first.portfolioValue - 1) * 100;
    } else {
      result[y] = 0;
    }
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  panel: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginTop: 8 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textMuted },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textMuted },
  chart: { borderRadius: 8, marginLeft: -16 },
  chartTitle: { fontSize: 12, color: colors.textMuted, marginBottom: 4, marginLeft: 4 },
});
