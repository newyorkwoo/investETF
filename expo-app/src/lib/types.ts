export interface DailyRecord {
  date: string;
  price: number;
  shares: number;
  invested: number;
  portfolioValue: number;
  returnPct: number;
  drawdownPct: number;
}

export interface BacktestResult {
  records: DailyRecord[];
  totalInvested: number;
  finalValue: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  effectiveStart: string;
  effectiveEnd: string;
}

/** [date, adjClose] tuples sorted by date ascending */
export type PriceData = [string, number][];

export interface SplitEvent {
  date: string;
  ratio: number;
}

export type SplitsData = Record<string, SplitEvent[]>;

export interface EtfData {
  prices: PriceData;
  firstDate: string;
  lastDate: string;
}

export interface AppData {
  etfs: Record<string, EtfData>;
  splits: SplitsData;
  updatedDate: string;
}
