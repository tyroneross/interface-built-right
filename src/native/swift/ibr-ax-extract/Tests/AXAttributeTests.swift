import XCTest
@testable import ibr_ax_extract

final class AXAttributeTests: XCTestCase {
    func snapshot(_ values: [String: Any], fallback: @escaping (String) -> Any? = { _ in nil }) -> AXAttributeSnapshot {
        AXAttributeSnapshot(values: AXAttributeSnapshot.names.map { values[$0] ?? NSNull() }, fallback: fallback)
    }
    func testStringsBoolsBoundsAndUnsupportedAttributes() {
        var point = CGPoint(x: 12, y: 24)
        var size = CGSize(width: 44, height: 48)
        let s = snapshot([kAXRoleAttribute: "AXButton", kAXEnabledAttribute: NSNumber(value: true),
            kAXPositionAttribute: AXValueCreate(.cgPoint, &point)!, kAXSizeAttribute: AXValueCreate(.cgSize, &size)!])
        XCTAssertEqual(s.string(kAXRoleAttribute), "AXButton")
        XCTAssertTrue(s.bool(kAXEnabledAttribute)); XCTAssertFalse(s.bool(kAXFocusedAttribute))
        XCTAssertEqual(s.point()?.x, 12); XCTAssertEqual(s.size()?.height, 48)
        XCTAssertNil(s.string(kAXSubroleAttribute)); XCTAssertEqual(s.children().count, 0)
    }
    func testPerAttributeErrorsDoNotHideTransientFailures() {
        var calls: [String] = []
        var unsupported = AXError.attributeUnsupported
        var transient = AXError.cannotComplete
        let s = snapshot([kAXTitleAttribute: AXValueCreate(.axError, &unsupported)!,
            kAXDescriptionAttribute: AXValueCreate(.axError, &transient)!], fallback: { calls.append($0); return "retried" })
        XCTAssertNil(s.string(kAXTitleAttribute))
        XCTAssertEqual(s.string(kAXDescriptionAttribute), "retried")
        XCTAssertEqual(calls, [kAXDescriptionAttribute])
    }
    func testNumericValuesKeepTheExistingStringOnlyContract() {
        XCTAssertNil(snapshot([kAXValueAttribute: NSNumber(value: 1)]).string(kAXValueAttribute))
    }
}

final class AXScalarValueTests: XCTestCase {
    func testNumericAndBooleanStateValues() {
        XCTAssertEqual(axScalarValue(NSNumber(value: 1)), "1")
        XCTAssertEqual(axScalarValue(NSNumber(value: 0)), "0")
        XCTAssertEqual(axScalarValue(NSNumber(value: 0.75)), "0.75")
        XCTAssertEqual(axScalarValue("reply"), "reply")
        XCTAssertNil(axScalarValue(nil))
        XCTAssertNil(axScalarValue(["unsupported"]))
    }
}
