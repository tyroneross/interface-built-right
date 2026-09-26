import XCTest
@testable import ibr_ax_extract

final class FrontmostGuardTests: XCTestCase {
    func testAllowsPostWhenTargetIsFrontmost() {
        XCTAssertNil(frontmostGuardError(targetPid: 42, frontmostPid: 42, frontmostName: "Target"))
    }

    func testRefusesPostWhenAnotherAppIsFrontmost() {
        let error = frontmostGuardError(targetPid: 42, frontmostPid: 7, frontmostName: "Easy Terminal")
        XCTAssertNotNil(error)
        XCTAssertTrue(error!.contains("Easy Terminal (pid 7)"))
    }

    func testRefusesPostWhenNoAppIsFrontmost() {
        XCTAssertNotNil(frontmostGuardError(targetPid: 42, frontmostPid: nil, frontmostName: nil))
    }
}
