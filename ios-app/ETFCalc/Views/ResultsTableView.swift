import SwiftUI

struct ResultsTableView: View {
    let results: [String: BacktestResult]
    let startMonth: String
    let endMonth: String

    private let syms: [String]

    init(results: [String: BacktestResult], startMonth: String, endMonth: String) {
        self.results = results
        self.startMonth = startMonth
        self.endMonth = endMonth
        self.syms = ETF_ORDER.filter { results[$0] != nil }
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: true) {
            VStack(spacing: 0) {
                // Header
                HStack(spacing: 0) {
                    ForEach(["ETF", "期間", "投入", "期末市值", "總報酬", "年化", "回撤", "Sharpe"], id: \.self) { h in
                        Text(h)
                            .font(.caption2.bold())
                            .foregroundColor(.secondary)
                            .frame(width: colWidth(h), alignment: .leading)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 4)
                    }
                }
                .background(Color(.tertiarySystemGroupedBackground))

                Divider()

                ForEach(Array(syms.enumerated()), id: \.element) { idx, sym in
                    if let r = results[sym], let meta = ETF_META[sym] {
                        HStack(spacing: 0) {
                            TableCell(text: sym,
                                      width: colWidth("ETF"),
                                      color: meta.color,
                                      bold: true)
                            TableCell(text: "\(startMonth)～\(endMonth)",
                                      width: colWidth("期間"))
                            TableCell(text: fmtTWD(r.totalInvested),
                                      width: colWidth("投入"))
                            TableCell(text: fmtTWD(r.finalValue),
                                      width: colWidth("期末市值"))
                            TableCell(text: String(format: "%.1f%%", r.totalReturnPct),
                                      width: colWidth("總報酬"),
                                      color: r.totalReturnPct >= 0 ? .green : .red)
                            TableCell(text: String(format: "%.2f%%", r.annualizedReturnPct),
                                      width: colWidth("年化"),
                                      color: r.annualizedReturnPct >= 0 ? .green : .red)
                            TableCell(text: String(format: "%.2f%%", r.maxDrawdownPct),
                                      width: colWidth("回撤"),
                                      color: .red)
                            TableCell(text: String(format: "%.2f", r.sharpeRatio),
                                      width: colWidth("Sharpe"))
                        }
                        .background(idx % 2 == 0
                            ? Color(.secondarySystemGroupedBackground)
                            : Color(.systemGroupedBackground))
                    }
                }
            }
            .cornerRadius(8)
        }
    }

    private func colWidth(_ h: String) -> CGFloat {
        switch h {
        case "ETF":  return 68
        case "期間":  return 120
        case "投入", "期末市值": return 80
        default:     return 68
        }
    }
}

private struct TableCell: View {
    let text: String
    let width: CGFloat
    var color: Color = .primary
    var bold: Bool = false

    var body: some View {
        Text(text)
            .font(bold ? .caption.bold() : .caption)
            .foregroundColor(color)
            .lineLimit(1)
            .frame(width: width, alignment: .leading)
            .padding(.vertical, 7)
            .padding(.horizontal, 4)
    }
}

private func fmtTWD(_ v: Double) -> String {
    if v >= 1_000_000 { return String(format: "%.2fM", v / 1_000_000) }
    if v >= 1_000     { return String(format: "%.1fK", v / 1_000) }
    return String(format: "%.0f", v)
}
