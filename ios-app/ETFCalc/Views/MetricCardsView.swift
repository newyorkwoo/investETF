import SwiftUI

struct MetricCardsView: View {
    let results: [String: BacktestResult]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(ETF_ORDER.filter { results[$0] != nil }, id: \.self) { sym in
                    if let r = results[sym], let meta = ETF_META[sym] {
                        MetricCard(sym: sym, meta: meta, result: r)
                    }
                }
            }
            .padding(.horizontal, 1)
        }
    }
}

private struct MetricCard: View {
    let sym: String
    let meta: ETFMeta
    let result: BacktestResult

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(sym)
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(meta.color)
            Text(meta.name)
                .font(.caption)
                .foregroundColor(.secondary)

            Divider()

            MetricRow(label: "期末市值",  value: fmtTWD(result.finalValue),       color: .primary)
            MetricRow(
                label: "年化報酬率",
                value: String(format: "%.2f%%", result.annualizedReturnPct),
                color: result.annualizedReturnPct >= 0 ? .green : .red
            )
            MetricRow(
                label: "最大回撤",
                value: String(format: "%.2f%%", result.maxDrawdownPct),
                color: .red
            )
            MetricRow(label: "Sharpe",   value: String(format: "%.2f", result.sharpeRatio), color: .primary)
        }
        .padding(12)
        .frame(width: 160)
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(meta.color, lineWidth: 1.5)
        )
    }
}

private struct MetricRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .fixedSize()
            Spacer()
            Text(value)
                .font(.caption.bold())
                .foregroundColor(color)
        }
    }
}

private func fmtTWD(_ v: Double) -> String {
    if v >= 1_000_000 { return String(format: "%.2fM", v / 1_000_000) }
    if v >= 1_000     { return String(format: "%.1fK", v / 1_000) }
    return String(format: "%.0f", v)
}
