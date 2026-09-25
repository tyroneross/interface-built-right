import XCTest
@testable import ibr_ax_extract

final class PermissionTests: XCTestCase {
    private var dir: URL!
    private var recordURL: URL { dir.appendingPathComponent(".ibr/permissions.json") }

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("ibr-perm-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testTrustedNeverPrompts() {
        for requested in [false, true] {
            XCTAssertEqual(accessibilityPromptDecision(trusted: true, promptRequested: requested), .trusted)
        }
    }

    func testUntrustedPromptsWhenAndOnlyWhenRequested() {
        XCTAssertEqual(accessibilityPromptDecision(trusted: false, promptRequested: true), .prompt)
        XCTAssertEqual(accessibilityPromptDecision(trusted: false, promptRequested: false), .failWithoutPrompt)
    }

    func testSettingsURLTargetsAccessibilityPane() {
        XCTAssertEqual(accessibilitySettingsURL,
                       "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
    }

    func testMissingOrMalformedRecordCountsAsNotAsked() throws {
        XCTAssertNil(accessibilityAskedAt(recordURL: recordURL))
        try FileManager.default.createDirectory(at: recordURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("not json".utf8).write(to: recordURL)
        XCTAssertNil(accessibilityAskedAt(recordURL: recordURL))
    }

    func testRecordRoundTripsAndPreservesOtherKeys() throws {
        try FileManager.default.createDirectory(at: recordURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(#"{"screenRecording":{"askedAt":"x"}}"#.utf8).write(to: recordURL)

        try recordAccessibilityPrompt(recordURL: recordURL, now: Date(timeIntervalSince1970: 0))

        XCTAssertEqual(accessibilityAskedAt(recordURL: recordURL), "1970-01-01T00:00:00Z")
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: recordURL)) as? [String: Any]
        XCTAssertNotNil(root?["screenRecording"])
        // A record never blocks an explicit request: the user asked to see it.
        XCTAssertEqual(accessibilityPromptDecision(trusted: false, promptRequested: true), .prompt)
    }

    func testMessagesNameSettingsPathAndReRequestStep() {
        let fresh = accessibilityUntrustedMessage(askedAt: nil, recordURL: recordURL)
        XCTAssertTrue(fresh.contains("Privacy & Security > Accessibility"))
        XCTAssertTrue(fresh.contains("ibr native:request-permission"))

        let asked = accessibilityUntrustedMessage(askedAt: "2026-09-17T00:00:00Z", recordURL: recordURL)
        XCTAssertTrue(asked.contains("2026-09-17T00:00:00Z"))
        XCTAssertTrue(asked.contains("ibr native:request-permission"))
        XCTAssertFalse(asked.contains("will not show it again"))
    }
}
