import Foundation

enum DataServiceError: Error {
    case fileNotFound(String)
    case decodingError(String)
}

class DataService {
    static let shared = DataService()

    private(set) var appData: AppData

    private init() {
        appData = Self.loadAppData()
    }

    private static func loadAppData() -> AppData {
        var etfMap: [String: EtfData] = [:]

        for sym in ETF_ORDER {
            guard let url = Bundle.main.url(forResource: sym, withExtension: "json"),
                  let data = try? Data(contentsOf: url),
                  let raw = try? JSONSerialization.jsonObject(with: data) as? [[Any]]
            else { continue }

            let prices: [(date: String, price: Double)] = raw.compactMap { item -> (String, Double)? in
                guard item.count >= 2,
                      let d = item[0] as? String,
                      let p = item[1] as? Double
                else { return nil }
                return (d, p)
            }
            guard !prices.isEmpty else { continue }

            etfMap[sym] = EtfData(
                prices: prices,
                firstDate: prices.first!.date,
                lastDate: prices.last!.date
            )
        }

        // Load splits
        var splitsMap: [String: [SplitEvent]] = [:]
        if let url = Bundle.main.url(forResource: "splits", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let raw = try? JSONDecoder().decode([String: [SplitEvent]].self, from: data) {
            splitsMap = raw
        }

        // Load meta
        var updatedDate = ""
        if let url = Bundle.main.url(forResource: "meta", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let raw = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            updatedDate = raw["updated"] ?? ""
        }

        return AppData(etfs: etfMap, splits: splitsMap, updatedDate: updatedDate)
    }
}
