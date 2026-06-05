import XCTest
@testable import NearMind

final class LiveSmokeChecklistTests: XCTestCase {
    func testChecklistStateTransitions() {
        var checklist = LiveSmokeChecklist()

        checklist.update(.apiHealthReachable, status: .running, detail: "checking")
        XCTAssertEqual(checklist.check(.apiHealthReachable)?.status, .running)
        XCTAssertEqual(checklist.check(.apiHealthReachable)?.detail, "checking")

        checklist.update(.apiHealthReachable, status: .passed, detail: "ok")
        XCTAssertEqual(checklist.check(.apiHealthReachable)?.status, .passed)

        checklist.update(.latencySummaryFetched, status: .skipped, detail: "no session")
        XCTAssertEqual(checklist.check(.latencySummaryFetched)?.status, .skipped)
    }
}
