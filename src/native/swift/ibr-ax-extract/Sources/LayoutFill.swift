import Foundation

// MARK: - Layout-fill / gap analysis (parity with TS analyzer)
//
// Optional in-Swift analysis pass over the extracted tree. Mirrors
// src/native/layout-fill.ts so a caller running the binary directly (without
// the IBR TS pipeline) can still get a fill / gap report. Emitted on stderr
// as `LAYOUT_FINDINGS:<json>` so it never corrupts the existing element JSON
// stdout contract. Gated behind --analyze-layout; default off; fully
// backward-compatible. Moved verbatim from main.swift during the E2-A refactor.

struct LayoutFillFinding: Codable {
    let containerRole: String
    let containerLabel: String
    let axis: String       // "horizontal" | "vertical"
    let emptyPx: Double
    let emptyPct: Double
    let position: String   // "leading" | "between" | "trailing"
    let containerWidth: Double
    let containerHeight: Double
    let detail: String
}

func labelOfAX(_ el: AXExtractedElement) -> String {
    for s in [el.title, el.description, el.identifier, el.value] {
        if let v = s, !v.isEmpty {
            return v.count > 40 ? String(v.prefix(40)) + "…" : v
        }
    }
    return ""
}

func largestBandSwift(min: Double, max: Double, spans: [(Double, Double)])
    -> (px: Double, position: String)?
{
    guard !spans.isEmpty else { return nil }
    let sorted = spans.sorted { $0.0 < $1.0 }
    var merged: [(Double, Double)] = []
    for s in sorted {
        if var last = merged.last, s.0 <= last.1 {
            last.1 = Swift.max(last.1, s.1)
            merged[merged.count - 1] = last
        } else {
            merged.append(s)
        }
    }
    var best: (Double, String) = (0, "leading")
    let leading = merged[0].0 - min
    if leading > best.0 { best = (leading, "leading") }
    for i in 1..<merged.count {
        let gap = merged[i].0 - merged[i - 1].1
        if gap > best.0 { best = (gap, "between") }
    }
    let trailing = max - merged[merged.count - 1].1
    if trailing > best.0 { best = (trailing, "trailing") }
    return (best.0, best.1)
}

func analyzeLayoutFillSwift(
    _ roots: [AXExtractedElement],
    threshold: Double = 0.12,
    minContainerPx: Double = 50,
    maxDepth: Int = 20
) -> [LayoutFillFinding] {
    var out: [LayoutFillFinding] = []

    func visit(_ el: AXExtractedElement, _ depth: Int) {
        if depth >= maxDepth { return }
        if let pos = el.position, let sz = el.size, sz.width > 0, sz.height > 0 {
            let r = (x: pos.x, y: pos.y, w: sz.width, h: sz.height)
            let laid = el.children.filter {
                ($0.position != nil) && ($0.size != nil)
                    && (($0.size?.width ?? 0) > 0) && (($0.size?.height ?? 0) > 0)
            }
            if !laid.isEmpty {
                // Horizontal
                if r.w >= minContainerPx {
                    let spans: [(Double, Double)] = laid.map {
                        let cp = $0.position!; let cs = $0.size!
                        return (cp.x, cp.x + cs.width)
                    }
                    if let band = largestBandSwift(min: r.x, max: r.x + r.w, spans: spans),
                        band.px / r.w >= threshold
                    {
                        let pct = band.px / r.w
                        let lbl = labelOfAX(el)
                        let detail =
                            "\(el.role)\(lbl.isEmpty ? "" : " [\(lbl)]"): \(band.position) empty band "
                            + "\(Int(band.px.rounded()))px = \(Int((pct * 100).rounded()))% of "
                            + "container width \(Int(r.w.rounded()))px (horizontal)"
                        out.append(
                            LayoutFillFinding(
                                containerRole: el.role,
                                containerLabel: lbl,
                                axis: "horizontal",
                                emptyPx: band.px,
                                emptyPct: pct,
                                position: band.position,
                                containerWidth: r.w,
                                containerHeight: r.h,
                                detail: detail
                            ))
                    }
                }
                // Vertical
                if r.h >= minContainerPx {
                    let spans: [(Double, Double)] = laid.map {
                        let cp = $0.position!; let cs = $0.size!
                        return (cp.y, cp.y + cs.height)
                    }
                    if let band = largestBandSwift(min: r.y, max: r.y + r.h, spans: spans),
                        band.px / r.h >= threshold
                    {
                        let pct = band.px / r.h
                        let lbl = labelOfAX(el)
                        let detail =
                            "\(el.role)\(lbl.isEmpty ? "" : " [\(lbl)]"): \(band.position) empty band "
                            + "\(Int(band.px.rounded()))px = \(Int((pct * 100).rounded()))% of "
                            + "container height \(Int(r.h.rounded()))px (vertical)"
                        out.append(
                            LayoutFillFinding(
                                containerRole: el.role,
                                containerLabel: lbl,
                                axis: "vertical",
                                emptyPx: band.px,
                                emptyPct: pct,
                                position: band.position,
                                containerWidth: r.w,
                                containerHeight: r.h,
                                detail: detail
                            ))
                    }
                }
            }
        }
        for c in el.children { visit(c, depth + 1) }
    }

    for r in roots { visit(r, 0) }
    return out.sorted { $0.emptyPct > $1.emptyPct }
}
