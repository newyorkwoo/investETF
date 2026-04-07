import SwiftUI

struct ETFMeta {
    let name: String
    let color: Color
}

let ETF_ORDER: [String] = ["0050", "00631L", "QQQ", "QQQM"]

let ETF_META: [String: ETFMeta] = [
    "0050":   ETFMeta(name: "元大台灣50",    color: Color(red: 0.96, green: 0.62, blue: 0.04)),
    "00631L": ETFMeta(name: "元大台灣50正2", color: Color(red: 0.20, green: 0.83, blue: 0.60)),
    "QQQ":    ETFMeta(name: "Invesco QQQ",  color: Color(red: 0.30, green: 0.61, blue: 0.91)),
    "QQQM":   ETFMeta(name: "QQQM",         color: Color(red: 0.65, green: 0.55, blue: 0.98)),
]

let PRESETS: [(String, Int)] = [
    ("3K",  3_000),
    ("5K",  5_000),
    ("1W",  10_000),
    ("2W",  20_000),
    ("3W",  30_000),
]
