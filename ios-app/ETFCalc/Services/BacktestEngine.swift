import Foundation

enum BacktestError: LocalizedError {
    case noDataInRange
    case invalidAmount

    var errorDescription: String? {
        switch self {
        case .noDataInRange: return "日期範圍內無可用資料"
        case .invalidAmount: return "每月投入金額必須大於 0"
        }
    }
}

struct BacktestEngine {

    /// Returns the last trading day of each month within [start, end]
    private static func monthEndDates(
        prices: [(date: String, price: Double)],
        start: String,
        end: String
    ) -> Set<String> {
        var monthLast: [String: String] = [:]
        for (d, _) in prices {
            guard d >= start && d <= end else { continue }
            let ym = String(d.prefix(7))
            if let cur = monthLast[ym] {
                if d > cur { monthLast[ym] = d }
            } else {
                monthLast[ym] = d
            }
        }
        return Set(monthLast.values)
    }

    static func run(
        etf: EtfData,
        startDate: String,
        endDate: String,
        monthlyAmount: Double
    ) throws -> BacktestResult {
        guard monthlyAmount > 0 else { throw BacktestError.invalidAmount }

        let availStart = etf.firstDate
        let availEnd   = etf.lastDate
        let effStart = startDate > availStart ? startDate : availStart
        let effEnd   = endDate   < availEnd   ? endDate   : availEnd

        let inRange = etf.prices.filter { $0.date >= effStart && $0.date <= effEnd }
        guard !inRange.isEmpty else { throw BacktestError.noDataInRange }

        let investSet = monthEndDates(prices: etf.prices, start: effStart, end: effEnd)

        var shares = 0.0
        var invested = 0.0
        var runningMax = 0.0
        var maxDrawdown = 0.0
        var records: [DailyRecord] = []
        records.reserveCapacity(inRange.count)

        for (date, price) in inRange {
            if investSet.contains(date) {
                shares   += monthlyAmount / price
                invested += monthlyAmount
            }

            let portfolioValue = shares * price
            if portfolioValue > runningMax { runningMax = portfolioValue }

            let drawdownPct = runningMax > 0
                ? (portfolioValue / runningMax - 1) * 100
                : 0.0
            if drawdownPct < maxDrawdown { maxDrawdown = drawdownPct }

            let returnPct = invested > 0 ? (portfolioValue / invested - 1) * 100 : 0.0

            records.append(DailyRecord(
                date: date,
                price: price,
                shares: shares,
                invested: invested,
                portfolioValue: portfolioValue,
                returnPct: returnPct,
                drawdownPct: drawdownPct
            ))
        }

        let last  = records.last!
        let first = records.first!
        let finalValue       = last.portfolioValue
        let totalInvested    = last.invested
        let totalReturnPct   = totalInvested > 0 ? (finalValue / totalInvested - 1) * 100 : 0.0

        // CAGR
        let msPerYear = 365.25 * 24 * 3600
        let df = ISO8601DateFormatter()
        df.formatOptions = [.withFullDate]
        let t0 = df.date(from: first.date)?.timeIntervalSince1970 ?? 0
        let t1 = df.date(from: last.date)?.timeIntervalSince1970  ?? 0
        let years = max((t1 - t0) / msPerYear, 1.0 / 365.25)
        let annualizedReturnPct = totalInvested > 0
            ? (pow(finalValue / totalInvested, 1.0 / years) - 1) * 100
            : 0.0

        // Sharpe ratio (daily, annualised with sqrt(252))
        var dailyRets: [Double] = []
        for i in 1..<records.count {
            let prev = records[i - 1].portfolioValue
            let curr = records[i].portfolioValue
            if prev > 0 && curr > 0 { dailyRets.append(curr / prev - 1) }
        }
        var sharpeRatio = 0.0
        let n = Double(dailyRets.count)
        if dailyRets.count > 1 {
            let mean = dailyRets.reduce(0, +) / n
            let variance = dailyRets.reduce(0) { $0 + pow($1 - mean, 2) } / (n - 1)
            let std = sqrt(variance)
            if std > 0 { sharpeRatio = (mean / std) * sqrt(252) }
        }

        return BacktestResult(
            records: records,
            totalInvested: totalInvested,
            finalValue: finalValue,
            totalReturnPct: totalReturnPct,
            annualizedReturnPct: annualizedReturnPct,
            maxDrawdownPct: maxDrawdown,
            sharpeRatio: sharpeRatio,
            effectiveStart: first.date,
            effectiveEnd: last.date
        )
    }
}
