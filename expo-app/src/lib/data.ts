import type { AppData, PriceData, SplitsData } from './types';
import { ETF_ORDER } from './etfMeta';

// Static imports — all data is bundled into the JS, no network needed.
import prices0050 from '../data/0050.json';
import prices00631L from '../data/00631L.json';
import pricesQQQ from '../data/QQQ.json';
import pricesQQQM from '../data/QQQM.json';
import splitsRaw from '../data/splits.json';
import metaRaw from '../data/meta.json';

const PRICE_MAP: Record<string, unknown> = {
  '0050':   prices0050,
  '00631L': prices00631L,
  'QQQ':    pricesQQQ,
  'QQQM':   pricesQQQM,
};

export function getAppData(): AppData {
  const etfs: AppData['etfs'] = {};
  for (const sym of ETF_ORDER) {
    const prices = PRICE_MAP[sym] as PriceData;
    if (!prices || prices.length === 0) continue;
    etfs[sym] = {
      prices,
      firstDate: prices[0][0],
      lastDate:  prices[prices.length - 1][0],
    };
  }
  return {
    etfs,
    splits: splitsRaw as unknown as SplitsData,
    updatedDate: (metaRaw as { updated: string }).updated,
  };
}

export function buildMonthOptions(
  etfs: AppData['etfs'],
  selectedSyms: string[],
): string[] {
  if (selectedSyms.length === 0) return [];
  let minDate = '9999-12';
  let maxDate = '0000-01';
  for (const sym of selectedSyms) {
    const e = etfs[sym];
    if (!e) continue;
    const fm = e.firstDate.slice(0, 7);
    const lm = e.lastDate.slice(0, 7);
    if (fm < minDate) minDate = fm;
    if (lm > maxDate) maxDate = lm;
  }
  const options: string[] = [];
  let [y, m] = minDate.split('-').map(Number) as [number, number];
  const [ey, em] = maxDate.split('-').map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    options.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return options;
}

export function monthToStartDate(ym: string): string {
  return `${ym}-01`;
}

export function monthToEndDate(ym: string): string {
  const [y, mn] = ym.split('-').map(Number) as [number, number];
  const lastDay = new Date(y, mn, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, '0')}`;
}

export function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = arr.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}
