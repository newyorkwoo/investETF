import type { PriceData, BacktestResult, DailyRecord } from './types';

/** Build a set of month-end trading dates within [start, end] */
function monthEndDates(prices: PriceData, start: string, end: string): Set<string> {
  const monthLast = new Map<string, string>();
  for (const [d] of prices) {
    if (d < start || d > end) continue;
    const ym = d.slice(0, 7);
    const cur = monthLast.get(ym);
    if (!cur || d > cur) monthLast.set(ym, d);
  }
  return new Set(monthLast.values());
}

export function runDcaBacktest(
  prices: PriceData,
  startDate: string,
  endDate: string,
  monthlyAmount: number,
): BacktestResult {
  // Filter to the ETF's available data range first, then clamp to user input
  const availStart = prices[0]?.[0] ?? startDate;
  const availEnd   = prices[prices.length - 1]?.[0] ?? endDate;
  const effStart = startDate > availStart ? startDate : availStart;
  const effEnd   = endDate   < availEnd   ? endDate   : availEnd;

  const inRange = prices.filter(([d]) => d >= effStart && d <= effEnd);
  if (inRange.length === 0) throw new Error('日期範圍內無可用資料');
  if (monthlyAmount <= 0)   throw new Error('每月投入金額必須大於 0');

  const investSet = monthEndDates(prices, effStart, effEnd);

  let shares = 0;
  let invested = 0;
  let runningMax = 0;
  let maxDrawdown = 0;
  const records: DailyRecord[] = [];

  for (const [date, price] of inRange) {
    if (investSet.has(date)) {
      shares  += monthlyAmount / price;
      invested += monthlyAmount;
    }

    const portfolioValue = shares * price;
    if (portfolioValue > runningMax) runningMax = portfolioValue;

    const drawdownPct = runningMax > 0
      ? (portfolioValue / runningMax - 1) * 100
      : 0;
    if (drawdownPct < maxDrawdown) maxDrawdown = drawdownPct;

    const returnPct = invested > 0
      ? (portfolioValue / invested - 1) * 100
      : 0;

    records.push({ date, price, shares, invested, portfolioValue, returnPct, drawdownPct });
  }

  const last = records[records.length - 1];
  const first = records[0];
  const finalValue    = last.portfolioValue;
  const totalInvested = last.invested;
  const totalReturnPct = totalInvested > 0
    ? (finalValue / totalInvested - 1) * 100
    : 0;

  // CAGR
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const years = Math.max(
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / msPerYear,
    1 / 365.25,
  );
  const annualizedReturnPct =
    ((finalValue / totalInvested) ** (1 / years) - 1) * 100;

  // Sharpe (daily portfolio changes, ddof=1, annualised with sqrt(252))
  // Only use days after first investment where both days have non-zero portfolio value
  const dailyRets: number[] = [];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1].portfolioValue;
    const curr = records[i].portfolioValue;
    if (prev > 0 && curr > 0) {
      dailyRets.push(curr / prev - 1);
    }
  }
  let sharpeRatio = 0;
  const n = dailyRets.length;
  if (n > 1) {
    const mean = dailyRets.reduce((a, b) => a + b, 0) / n;
    const variance = dailyRets.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    if (std > 0) sharpeRatio = (mean / std) * Math.sqrt(252);
  }

  return {
    records,
    totalInvested,
    finalValue,
    totalReturnPct,
    annualizedReturnPct,
    maxDrawdownPct: maxDrawdown,
    sharpeRatio,
    effectiveStart: first.date,
    effectiveEnd:   last.date,
  };
}
