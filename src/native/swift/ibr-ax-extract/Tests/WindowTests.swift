import XCTest
@testable import ibr_ax_extract
final class WindowTests: XCTestCase {
    func testExactSelection() {
        XCTAssertEqual(resizeWindowMatches(titles: ["", "Editor"], title: ""), [0])
        XCTAssertEqual(resizeWindowMatches(titles: ["Editor", "Editor"], title: "Editor"), [0, 1])
        XCTAssertEqual(resizeWindowMatches(titles: ["Editor"], title: "editor"), [])
        XCTAssertEqual(resizeWindowMatches(titles: ["A", "B"], title: nil), [0, 1])
    }
    func testDimensionValidation() throws {
        XCTAssertTrue(WindowResizeSpec(width: 900, height: 650, windowTitle: "").isValid)
        for width in [Double.nan, .infinity, 0, -1, 16385] {
            XCTAssertFalse(WindowResizeSpec(width: width, height: 650, windowTitle: nil).isValid)
        }
        XCTAssertThrowsError(try JSONDecoder().decode(WindowResizeSpec.self, from: Data("{\"width\":true,\"height\":650}".utf8)))
    }
}
