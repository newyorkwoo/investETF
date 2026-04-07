import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { AppData, BacktestResult } from '../lib/types';
import { ETF_ORDER, ETF_META, type EtfSymbol } from '../lib/etfMeta';
import { colors } from './theme';

// ── ETF Selector ──────────────────────────────────────────────
interface ETFSelectorProps {
  appData: AppData;
  selected: Set<string>;
  onToggle: (sym: string) => void;
}

export function ETFSelector({ appData, selected, onToggle }: ETFSelectorProps) {
  return (
    <View style={styles.etfRow}>
      {ETF_ORDER.map(sym => {
        if (!appData.etfs[sym]) return null;
        const meta = ETF_META[sym as EtfSymbol];
        const isOn = selected.has(sym);
        return (
          <TouchableOpacity
            key={sym}
            style={[styles.etfBtn, isOn && { borderColor: meta.color, backgroundColor: `${meta.color}22` }]}
            onPress={() => onToggle(sym)}
            activeOpacity={0.7}
          >
            <Text style={[styles.etfBtnSymbol, { color: isOn ? meta.color : colors.textMuted }]}>
              {isOn ? '✓ ' : ''}{sym}
            </Text>
            <Text style={styles.etfBtnName}>{meta.name}</Text>
            <Text style={styles.etfBtnSince}>since {appData.etfs[sym].firstDate.slice(0, 7)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Metric Cards ──────────────────────────────────────────────
interface MetricCardsProps {
  results: Record<string, BacktestResult>;
}

export function MetricCards({ results }: MetricCardsProps) {
  const syms = ETF_ORDER.filter(s => s in results);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
      {syms.map(sym => {
        const r = results[sym];
        const meta = ETF_META[sym as EtfSymbol];
        return (
          <View key={sym} style={[styles.card, { borderColor: meta.color }]}>
            <Text style={[styles.cardSym, { color: meta.color }]}>{sym}</Text>
            <Text style={styles.cardName}>{meta.name}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>期末市值</Text>
              <Text style={styles.cardVal}>{fmtTWD(r.finalValue)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>年化報酬率</Text>
              <Text style={[styles.cardVal, r.annualizedReturnPct >= 0 ? styles.pos : styles.neg]}>
                {r.annualizedReturnPct.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>最大回撤</Text>
              <Text style={[styles.cardVal, styles.neg]}>{r.maxDrawdownPct.toFixed(2)}%</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Sharpe</Text>
              <Text style={styles.cardVal}>{r.sharpeRatio.toFixed(2)}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Results Table ─────────────────────────────────────────────
interface ResultsTableProps {
  results: Record<string, BacktestResult>;
  startMonth: string;
  endMonth: string;
}

export function ResultsTable({ results, startMonth, endMonth }: ResultsTableProps) {
  const syms = ETF_ORDER.filter(s => s in results);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
      <View>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          {['ETF', '期間', '投入', '期末市值', '總報酬', '年化', '回撤', 'Sharpe'].map(h => (
            <Text key={h} style={[styles.tableCell, styles.tableHeadText]}>{h}</Text>
          ))}
        </View>
        {syms.map((sym, i) => {
          const r = results[sym];
          const meta = ETF_META[sym as EtfSymbol];
          return (
            <View key={sym} style={[styles.tableRow, i % 2 === 0 ? styles.tableEven : styles.tableOdd]}>
              <Text style={[styles.tableCell, { color: meta.color, fontWeight: '700' }]}>{sym}</Text>
              <Text style={styles.tableCell}>{startMonth}～{endMonth}</Text>
              <Text style={styles.tableCell}>{fmtTWD(r.totalInvested)}</Text>
              <Text style={styles.tableCell}>{fmtTWD(r.finalValue)}</Text>
              <Text style={[styles.tableCell, r.totalReturnPct >= 0 ? styles.pos : styles.neg]}>
                {r.totalReturnPct.toFixed(1)}%
              </Text>
              <Text style={[styles.tableCell, r.annualizedReturnPct >= 0 ? styles.pos : styles.neg]}>
                {r.annualizedReturnPct.toFixed(2)}%
              </Text>
              <Text style={[styles.tableCell, styles.neg]}>{r.maxDrawdownPct.toFixed(2)}%</Text>
              <Text style={styles.tableCell}>{r.sharpeRatio.toFixed(2)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function fmtTWD(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ETF Selector
  etfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etfBtn: {
    flex: 1, minWidth: '44%', padding: 10,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  etfBtnSymbol: { fontSize: 15, fontWeight: '700' },
  etfBtnName: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  etfBtnSince: { fontSize: 10, color: colors.textDim, marginTop: 2 },

  // Metric Cards
  cardScroll: { marginHorizontal: -4 },
  card: {
    width: 160, marginHorizontal: 4, padding: 12,
    borderRadius: 12, borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  cardSym: { fontSize: 16, fontWeight: '800' },
  cardName: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardLabel: { fontSize: 11, color: colors.textMuted },
  cardVal: { fontSize: 12, color: colors.text, fontWeight: '600' },

  // Table
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: colors.cardHover },
  tableEven: { backgroundColor: colors.card },
  tableOdd: { backgroundColor: colors.bg },
  tableCell: { width: 90, paddingVertical: 7, paddingHorizontal: 6, fontSize: 12, color: colors.text },
  tableHeadText: { color: colors.textMuted, fontWeight: '700', fontSize: 11 },

  // Common
  pos: { color: '#34D399' },
  neg: { color: '#F87171' },
});
