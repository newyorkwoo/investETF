import SwiftUI
import Charts

enum ChartTab: String, CaseIterable {
    case value     = "市值"
    case returnPct = "投報率"
    case drawdown  = "回撤"
}

private struct ChartPoint: Identifiable {
    let id: String
    let sym: String
    let date: Date
    let value: Double
}

// ISO8601 date parser — reuse a single instance for performance
private let dateFmt: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(secondsFromGMT: 0)
    return f
}()

private func parseDate(_ s: String) -> Date {
    dateFmt.date(from: s) ?? Date.distantPast
}

struct ChartPanelView: View {
    let results: [String: BacktestResult]
    @State private var tab: ChartTab = .value

    private let maxPts = 300
    private var syms: [String] { ETF_ORDER.filter { results[$0] != nil } }

    private func chartPoints(for tab: ChartTab) -> [ChartPoint] {
        var pts: [ChartPoint] = []
        for sym in syms {
            guard let r = results[sym] else { continue }
            let sampled = downsample(r.records, to: maxPts)
            for rec in sampled {
                let y: Double
                switch tab {
                case .value:     y = rec.portfolioValue
                case .returnPct: y = rec.returnPct
                case .drawdown:  y = rec.drawdownPct
                }
                pts.append(ChartPoint(
                    id: "\(sym)-\(rec.date)",
                    sym: sym,
                    date: parseDate(rec.date),
                    value: y
                ))
            }
        }
        return pts
    }

    // 已投入參考線（只用於市值圖）
    private func investedPoints() -> [ChartPoint] {
        guard let sym = syms.first, let r = results[sym] else { return [] }
        return downsample(r.records, to: maxPts).map {
            ChartPoint(id: "inv-\($0.date)", sym: "__invested",
                       date: parseDate($0.date), value: $0.invested)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Tab bar — segmented picker avoids gesture conflicts with Swift Charts
            Picker("", selection: $tab) {
                ForEach(ChartTab.allCases, id: \.self) { t in
                    Text(t.rawValue).tag(t)
                }
            }
            .pickerStyle(.segmented)

            let points   = chartPoints(for: tab)
            let invested = tab == .value ? investedPoints() : []

            Chart {
                ForEach(points) { pt in
                    LineMark(
                        x: .value("日期", pt.date),
                        y: .value("值",   pt.value),
                        series: .value("ETF", pt.sym)
                    )
                    .foregroundStyle(ETF_META[pt.sym]?.color ?? .gray)
                    .interpolationMethod(.linear)
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                }
                ForEach(invested) { pt in
                    LineMark(
                        x: .value("日期", pt.date),
                        y: .value("值",   pt.value),
                        series: .value("ETF", pt.sym)
                    )
                    .foregroundStyle(Color.white.opacity(0.35))
                    .interpolationMethod(.linear)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                }
                if tab == .returnPct || tab == .drawdown {
                    RuleMark(y: .value("0", 0))
                        .foregroundStyle(Color.white.opacity(0.25))
                        .lineStyle(StrokeStyle(lineWidth: 0.5))
                }
            }
            .id(tab)
            .allowsHitTesting(false)
            .chartLegend(.hidden)
            .chartXAxis {
                AxisMarks(values: .stride(by: .year, count: 3)) {
                    AxisGridLine().foregroundStyle(Color.white.opacity(0.08))
                    AxisValueLabel(format: .dateTime.year())
                        .foregroundStyle(Color.secondary)
                        .font(.caption2)
                }
            }
            .chartYAxis {
                AxisMarks(position: .trailing) {
                    AxisGridLine().foregroundStyle(Color.white.opacity(0.08))
                    AxisTick().foregroundStyle(Color.white.opacity(0.3))
                    AxisValueLabel()
                        .foregroundStyle(Color.secondary)
                        .font(.caption2)
                }
            }
            .frame(height: 220)

            // Legend
            HStack(spacing: 12) {
                ForEach(syms, id: \.self) { sym in
                    HStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(ETF_META[sym]?.color ?? .gray)
                            .frame(width: 16, height: 3)
                        Text(sym).font(.caption2).foregroundColor(.secondary)
                    }
                }
                if tab == .value {
                    HStack(spacing: 4) {
                        Rectangle()
                            .fill(Color.white.opacity(0.35))
                            .frame(width: 16, height: 1)
                        Text("投入").font(.caption2).foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private func downsample(_ arr: [DailyRecord], to maxPoints: Int) -> [DailyRecord] {
        guard arr.count > maxPoints else { return arr }
        let step = Double(arr.count) / Double(maxPoints)
        return (0..<maxPoints).map { arr[Int(Double($0) * step)] }
    }
}
