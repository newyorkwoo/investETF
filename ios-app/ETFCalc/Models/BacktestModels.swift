import Foundation

// [date, adjClose] tuples sorted ascending
typealias PriceData = [[Double]]   // actually [[String, Double]] stored as JSON

struct SplitEvent: Codable {
    let date: String
    let ratio: Double
}

struct EtfData {
    let prices: [(date: String, price: Double)]
    let firstDate: String
    let lastDate: String
}

struct AppData {
    let etfs: [String: EtfData]
    let splits: [String: [SplitEvent]]
    let updatedDate: String
}

struct DailyRecord {
    let date: String
    let price: Double
    let shares: Double
    let invested: Double
    let portfolioValue: Double
    let returnPct: Double
    let drawdownPct: Double
}

struct BacktestResult {
    let records: [DailyRecord]
    let totalInvested: Double
    let finalValue: Double
    let totalReturnPct: Double
    let annualizedReturnPct: Double
    let maxDrawdownPct: Double
    let sharpeRatio: Double
    let effectiveStart: String
    let effectiveEnd: String
}
