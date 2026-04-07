export interface EtfMeta {
  name: string;
  color: string;
}

export const ETF_ORDER = ['0050', '00631L', 'QQQ', 'QQQM'] as const;
export type EtfSymbol = (typeof ETF_ORDER)[number];

export const ETF_META: Record<EtfSymbol, EtfMeta> = {
  '0050':   { name: '元大台灣50',    color: '#F59E0B' },
  '00631L': { name: '元大台灣50正2', color: '#34D399' },
  'QQQ':    { name: 'Invesco QQQ',  color: '#4C9BE8' },
  'QQQM':   { name: 'QQQM',         color: '#A78BFA' },
};

export const PRESETS: [string, number][] = [
  ['3K', 3000],
  ['5K', 5000],
  ['1W', 10000],
  ['2W', 20000],
  ['3W', 30000],
];
