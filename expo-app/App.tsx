import React, { useState, useCallback } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StatusBar, StyleSheet, Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getAppData, buildMonthOptions, monthToStartDate, monthToEndDate } from './src/lib/data';
import { runDcaBacktest } from './src/lib/backtest';
import { PRESETS } from './src/lib/etfMeta';
import type { BacktestResult } from './src/lib/types';
import { ETFSelector, MetricCards, ResultsTable } from './src/components/Results';
import { ChartPanel } from './src/components/ChartPanel';
import { colors } from './src/components/theme';

// Data is bundled — synchronous, always available
const APP_DATA = getAppData();
const ALL_MONTHS = buildMonthOptions(APP_DATA.etfs, Object.keys(APP_DATA.etfs));

export default function App() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['0050', 'QQQ']));
  const [monthlyAmt, setMonthlyAmt] = useState(30000);
  const [inputAmt, setInputAmt] = useState('30000');
  const [startMonth, setStartMonth] = useState(ALL_MONTHS[0] ?? '');
  const [endMonth, setEndMonth] = useState(ALL_MONTHS[ALL_MONTHS.length - 1] ?? '');
  const [results, setResults] = useState<Record<string, BacktestResult> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const monthOptions = buildMonthOptions(APP_DATA.etfs, [...selected]);

  const toggleEtf = useCallback((sym: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sym)) { if (next.size > 1) next.delete(sym); }
      else next.add(sym);
      return next;
    });
    setResults(null);
  }, []);

  const handleCalculate = useCallback(() => {
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
      } catch (e) { newErrors[sym] = String(e); }
    }
    setResults(newResults);
    setErrors(newErrors);
  }, [selected, startMonth, endMonth, monthlyAmt]);

  const adjustAmt = (delta: number) => {
    const v = Math.max(0, monthlyAmt + delta);
    setMonthlyAmt(v);
    setInputAmt(String(v));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ETF 定期定額試算</Text>
          <Text style={styles.subtitle}>資料日期：{APP_DATA.updatedDate}</Text>
        </View>

        {/* ETF Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>選擇 ETF（可多選）</Text>
          <ETFSelector appData={APP_DATA} selected={selected} onToggle={toggleEtf} />
        </View>

        <View style={styles.divider} />

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>每月投入 TWD</Text>
          <View style={styles.amtRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAmt(-1000)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amtInput}
              value={inputAmt}
              onChangeText={v => {
                setInputAmt(v);
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) setMonthlyAmt(n);
              }}
              onBlur={() => setInputAmt(String(monthlyAmt))}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.stepBtn} onPress={() => adjustAmt(1000)}>
              <Text style={styles.stepBtnText}>＋</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.presets}>
            {PRESETS.map(([label, val]) => (
              <TouchableOpacity
                key={label}
                style={[styles.presetBtn, monthlyAmt === val && styles.presetBtnActive]}
                onPress={() => { setMonthlyAmt(val); setInputAmt(String(val)); }}
              >
                <Text style={[styles.presetText, monthlyAmt === val && styles.presetTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Month Pickers */}
        <View style={styles.monthRow}>
          <View style={styles.monthCol}>
            <Text style={styles.sectionLabel}>開始月份</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={startMonth}
                onValueChange={v => { setStartMonth(v); setResults(null); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                dropdownIconColor={colors.textMuted}
              >
                {monthOptions.map(m => <Picker.Item key={m} label={m} value={m} />)}
              </Picker>
            </View>
          </View>
          <View style={styles.monthCol}>
            <Text style={styles.sectionLabel}>結束月份</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={endMonth}
                onValueChange={v => { setEndMonth(v); setResults(null); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                dropdownIconColor={colors.textMuted}
              >
                {monthOptions.map(m => <Picker.Item key={m} label={m} value={m} />)}
              </Picker>
            </View>
          </View>
        </View>

        {/* Calculate Button */}
        <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate} activeOpacity={0.8}>
          <Text style={styles.calcBtnText}>▶ 開始試算</Text>
        </TouchableOpacity>

        {/* Errors */}
        {Object.entries(errors).map(([sym, msg]) => (
          <View key={sym} style={styles.errorBanner}>
            <Text style={styles.errorText}>{sym}：{msg}</Text>
          </View>
        ))}

        {/* Results */}
        {results && Object.keys(results).length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                採用除權息調整後收盤價（Adj Close），含股息再投入的總報酬試算。
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>比較指標</Text>
              <MetricCards results={results} />
            </View>

            <View style={styles.section}>
              <ResultsTable results={results} startMonth={startMonth} endMonth={endMonth} />
            </View>

            <View style={styles.divider} />

            <ChartPanel results={results} splits={APP_DATA.splits} />
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>資料來源：Yahoo Finance　僅供學習參考，非投資建議</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  header: { marginBottom: 20, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 12, color: colors.textMuted },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 8, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },

  // Amount
  amtRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: colors.text },
  amtInput: {
    flex: 1, height: 44, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, color: colors.text, fontSize: 16,
    textAlign: 'center',
  },
  presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  presetBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  presetTextActive: { color: '#fff' },

  // Month Pickers
  monthRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  monthCol: { flex: 1 },
  pickerWrap: {
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: colors.border, borderRadius: 10,
    overflow: 'hidden',
    height: Platform.OS === 'ios' ? 120 : 48,
  },
  picker: { color: colors.text, backgroundColor: 'transparent' },
  pickerItem: { color: colors.text, fontSize: 14, height: 120 },

  // Calculate Button
  calcBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  calcBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Error
  errorBanner: {
    backgroundColor: '#3f1d1d', borderWidth: 1, borderColor: '#7f3131',
    borderRadius: 8, padding: 10, marginBottom: 8,
  },
  errorText: { color: '#F87171', fontSize: 13 },

  // Info
  infoBox: {
    backgroundColor: colors.card, borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },

  // Footer
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 11, color: colors.textDim },
});
