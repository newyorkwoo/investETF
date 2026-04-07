import SwiftUI

// MARK: – ETF Selector

struct ETFSelectorView: View {
    let appData: AppData
    @Binding var selected: Set<String>

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(ETF_ORDER, id: \.self) { sym in
                if appData.etfs[sym] != nil, let meta = ETF_META[sym] {
                    ETFButton(
                        sym: sym,
                        meta: meta,
                        since: appData.etfs[sym]!.firstDate.prefix(7).description,
                        isOn: selected.contains(sym)
                    ) {
                        if selected.contains(sym) {
                            if selected.count > 1 { selected.remove(sym) }
                        } else {
                            selected.insert(sym)
                        }
                    }
                }
            }
        }
    }
}

private struct ETFButton: View {
    let sym: String
    let meta: ETFMeta
    let since: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    if isOn {
                        Image(systemName: "checkmark")
                            .font(.caption2.bold())
                            .foregroundColor(meta.color)
                    }
                    Text(sym)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(isOn ? meta.color : .secondary)
                }
                Text(meta.name)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("since \(since)")
                    .font(.caption2)
                    .foregroundColor(Color(.tertiaryLabel))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isOn ? meta.color.opacity(0.13) : Color(.secondarySystemGroupedBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isOn ? meta.color : Color(.separator), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}
