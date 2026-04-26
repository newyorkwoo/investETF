import SwiftUI

// MARK: - Month helpers

func buildMonthOptions(_ etfs: [String: EtfData], selected: Set<String>) -> [String] {
    guard !selected.isEmpty else { return [] }
    var minDate = "9999-12"
    var maxDate = "0000-01"
    for sym in selected {
        guard let e = etfs[sym] else { continue }
        let fm = String(e.firstDate.prefix(7))
        let lm = String(e.lastDate.prefix(7))
        if fm < minDate { minDate = fm }
        if lm > maxDate { maxDate = lm }
    }
    var options: [String] = []
    let comps = minDate.split(separator: "-").compactMap { Int($0) }
    let endComps = maxDate.split(separator: "-").compactMap { Int($0) }
    guard comps.count == 2, endComps.count == 2 else { return [] }
    var (y, m) = (comps[0], comps[1])
    let (ey, em) = (endComps[0], endComps[1])
    while y < ey || (y == ey && m <= em) {
        options.append(String(format: "%04d-%02d", y, m))
        m += 1
        if m > 12 { m = 1; y += 1 }
    }
    return options
}

func monthToStartDate(_ ym: String) -> String { "\(ym)-01" }

func monthToEndDate(_ ym: String) -> String {
    let parts = ym.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 2 else { return "\(ym)-28" }
    let lastDay = Calendar.current.range(of: .day, in: .month,
        for: Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1]))!)!.count
    return String(format: "%@-%02d", ym, lastDay)
}

// MARK: - ContentView

struct ContentView: View {
    private let appData = DataService.shared.appData
    @State private var selected: Set<String> = ["0050", "QQQ"]
    @State private var monthlyAmt: Int = 30_000
    @State private var inputAmt: String = "30000"
    @State private var startMonth: String = ""
    @State private var endMonth: String = ""
    @State private var results: [String: BacktestResult] = [:]
    @State private var errors: [String: String] = [:]
    @State private var isCalculating = false
    @FocusState private var isAmountFocused: Bool

    private var monthOptions: [String] {
        buildMonthOptions(appData.etfs, selected: selected)
    }

    var body: some View {
        NavigationView {
            Form {
                // ── ETF ──
                Section("選擇 ETF（可多選）") {
                    ETFSelectorView(appData: appData, selected: $selected)
                        .onChange(of: selected) { _ in clearResults() }
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                }

                // ── Amount ──
                Section("每月投入 TWD") {
                    HStack {
                        StepButton(label: "−") { adjustAmt(-1000) }
                        TextField("金額", text: $inputAmt)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.center)
                            .font(.title3.bold())
                            .focused($isAmountFocused)
                            .onChange(of: inputAmt) { v in
                                if let n = Int(v), n >= 0 { monthlyAmt = n }
                            }
                            .onSubmit { inputAmt = "\(monthlyAmt)" }
                            .toolbar {
                                ToolbarItemGroup(placement: .keyboard) {
                                    Spacer()
                                    Button("完成") {
                                        isAmountFocused = false
                                        inputAmt = "\(monthlyAmt)"
                                    }
                                }
                            }
                        StepButton(label: "＋") { adjustAmt(1000) }
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(PRESETS, id: \.0) { label, val in
                                Button(label) {
                                    monthlyAmt = val
                                    inputAmt = "\(val)"
                                    isAmountFocused = false
                                }
                                .font(.caption.bold())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(monthlyAmt == val ? Color.accentColor : Color(.tertiarySystemGroupedBackground))
                                .foregroundColor(monthlyAmt == val ? .white : .primary)
                                .cornerRadius(6)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8))
                }

                // ── Month range ──
                Section("投資期間") {
                    Picker("開始月份", selection: $startMonth) {
                        ForEach(monthOptions, id: \.self) { Text($0).tag($0) }
                    }
                    .onChange(of: startMonth) { _ in clearResults() }
                    Picker("結束月份", selection: $endMonth) {
                        ForEach(monthOptions, id: \.self) { Text($0).tag($0) }
                    }
                    .onChange(of: endMonth) { _ in clearResults() }
                }

                // ── Calculate ──
                Section {
                    Button(action: calculate) {
                        HStack {
                            Spacer()
                            if isCalculating {
                                ProgressView().padding(.trailing, 6)
                            }
                            Text("開始試算")
                                .font(.headline)
                            Spacer()
                        }
                    }
                    .disabled(isCalculating || selected.isEmpty)
                }

                // ── Errors ──
                if !errors.isEmpty {
                    Section("錯誤") {
                        ForEach(errors.sorted(by: { $0.key < $1.key }), id: \.key) { sym, msg in
                            Text("\(sym): \(msg)")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                }

                // ── Results ──
                if !results.isEmpty {
                    Section("績效概覽") {
                        MetricCardsView(results: results)
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }

                    Section("走勢圖") {
                        ChartPanelView(results: results)
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }

                    Section("比較表") {
                        ResultsTableView(results: results, startMonth: startMonth, endMonth: endMonth)
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }
                }
            }
            .navigationTitle("ETF 定期定額試算")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Text("資料：\(appData.updatedDate)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationViewStyle(.stack)
        .onAppear { initMonths() }
    }

    // MARK: - Helpers

    private func initMonths() {
        let opts = buildMonthOptions(appData.etfs, selected: selected)
        if startMonth.isEmpty { startMonth = opts.first ?? "" }
        if endMonth.isEmpty   { endMonth   = opts.last  ?? "" }
    }

    private func clearResults() {
        results = [:]
        errors  = [:]
    }

    private func adjustAmt(_ delta: Int) {
        monthlyAmt = max(0, monthlyAmt + delta)
        inputAmt   = "\(monthlyAmt)"
    }

    private func calculate() {
        isCalculating = true
        DispatchQueue.global(qos: .userInitiated).async {
            var newResults: [String: BacktestResult] = [:]
            var newErrors:  [String: String]         = [:]
            let amt = Double(monthlyAmt)
            let sd  = monthToStartDate(startMonth)
            let ed  = monthToEndDate(endMonth)
            for sym in selected {
                guard let etf = appData.etfs[sym] else { newErrors[sym] = "無資料"; continue }
                do {
                    newResults[sym] = try BacktestEngine.run(etf: etf, startDate: sd, endDate: ed, monthlyAmount: amt)
                } catch {
                    newErrors[sym] = error.localizedDescription
                }
            }
            DispatchQueue.main.async {
                results       = newResults
                errors        = newErrors
                isCalculating = false
            }
        }
    }
}

// MARK: - StepButton

private struct StepButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.title2)
                .frame(width: 44, height: 36)
                .background(Color(.tertiarySystemGroupedBackground))
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}
