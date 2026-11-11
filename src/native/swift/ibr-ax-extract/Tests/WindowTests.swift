import XCTest
@testable import ibr_ax_extract
final class WindowTests: XCTestCase {
    func testExactSelection() {
        XCTAssertEqual(resizeWindowMatches(titles: ["", "Editor"], title: ""), [0])
        XCTAssertEqual(resizeWindowMatches(titles: ["Editor", "Editor"], title: "Editor"), [0, 1])
        XCTAssertEqual(resizeWindowMatches(titles: ["Editor"], title: "editor"), [])
        XCTAssertEqual(resizeWindowMatches(titles: ["A", "B"], title: nil), [0, 1])
    }
    /// A parent window and its child panel from the same pid: only the frame
    /// that equals the AX window's frame is the one to capture.
    func testCGWindowMatchesOnlyTheSameFrame() {
        let panel = CGPoint(x: 640, y: 300), panelSize = CGSize(width: 932, height: 264)
        XCTAssertTrue(cgWindowMatchesAXFrame(CGRect(x: 640.4, y: 300, width: 932, height: 264.5), origin: panel, size: panelSize))
        XCTAssertFalse(cgWindowMatchesAXFrame(CGRect(x: 0, y: 25, width: 1800, height: 1100), origin: panel, size: panelSize))
        XCTAssertFalse(cgWindowMatchesAXFrame(CGRect(x: 640, y: 300, width: 932, height: 540), origin: panel, size: panelSize),
                       "Same origin, expanded height is a different frame")
    }
    func testDimensionValidation() throws {
        XCTAssertTrue(WindowResizeSpec(width: 900, height: 650, windowTitle: "").isValid)
        for width in [Double.nan, .infinity, 0, -1, 16385] {
            XCTAssertFalse(WindowResizeSpec(width: width, height: 650, windowTitle: nil).isValid)
        }
        XCTAssertThrowsError(try JSONDecoder().decode(WindowResizeSpec.self, from: Data("{\"width\":true,\"height\":650}".utf8)))
    }
}
