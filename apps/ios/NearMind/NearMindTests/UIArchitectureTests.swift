import XCTest
@testable import NearMind

final class UIArchitectureTests: XCTestCase {
    func testRootTabStructure() {
        XCTAssertEqual(AppTab.allCases.map(\.title), ["Chat", "Live", "Sessions", "You"])
        XCTAssertEqual(AppTab.allCases.map(\.systemImage), ["bubble.left.and.bubble.right", "mic.circle", "clock", "person.crop.circle"])
    }

    func testOnboardingProgressionContent() {
        let pages = OnboardingPage.defaults

        XCTAssertEqual(pages.count, 3)
        XCTAssertEqual(pages.map(\.title), ["NearMind", "Consent-first", "Control"])
        XCTAssertTrue(pages[0].message.contains("private AI"))
        XCTAssertTrue(pages[1].message.contains("No hidden recording"))
        XCTAssertTrue(pages[2].message.contains("Keychain"))
    }

    func testTodayContentEmptyState() {
        let content = TodayContent.empty

        XCTAssertFalse(content.hasBrief)
        XCTAssertFalse(content.hasTasks)
        XCTAssertFalse(content.hasRecentSessions)
    }

    @MainActor
    func testTodayContentBuildsFromMobileSync() {
        let items = [
            MobileSyncItem(type: "daily_brief", item: ["summary": JSONValue("Review loan terms before the meeting.")]),
            MobileSyncItem(type: "task", item: ["title": JSONValue("Ask about fees.")]),
            MobileSyncItem(type: "voice_session", item: [
                "sessionId": JSONValue("session-1"),
                "title": JSONValue("Bank meeting"),
                "summary": JSONValue("Prepared questions about APR."),
                "status": JSONValue("saved"),
                "createdAt": JSONValue("2026-06-05T09:00:00Z")
            ])
        ]

        let content = TodayViewModel.makeContent(from: items)

        XCTAssertEqual(content.briefText, "Review loan terms before the meeting.")
        XCTAssertEqual(content.openTaskCount, 1)
        XCTAssertEqual(content.recentSessions.first?.title, "Bank meeting")
    }

    func testSessionsListEmptyState() {
        XCTAssertTrue(SessionsContent.empty.isEmpty)
    }

    func testSessionItemDecodesAvailableSyncFields() {
        let syncItem = MobileSyncItem(type: "voice_session", item: [
            "sessionId": JSONValue("session-2"),
            "title": JSONValue("APR review"),
            "preview": JSONValue("Arrangement fee noticed."),
            "retentionPolicy": JSONValue("discard_on_stop"),
            "createdAt": JSONValue("2026-06-05T09:00:00Z"),
            "cues": JSONValue([JSONValue("Ask whether the APR includes fees.")]),
            "commitments": JSONValue([JSONValue("Send updated terms.")]),
            "followUps": JSONValue([JSONValue("Compare prepayment penalties.")])
        ])

        let item = SessionListItem.from(syncItem: syncItem)

        XCTAssertEqual(item?.id, "session-2")
        XCTAssertEqual(item?.title, "APR review")
        XCTAssertEqual(item?.retentionStatus, .discarded)
        XCTAssertEqual(item?.cues, ["Ask whether the APR includes fees."])
        XCTAssertEqual(item?.commitments, ["Send updated terms."])
        XCTAssertEqual(item?.followUps, ["Compare prepayment penalties."])
        XCTAssertNotNil(item?.date)
    }

    func testYouSectionsKeepDeveloperToolsLast() {
        XCTAssertEqual(YouSection.allCases.map(\.rawValue), [
            "Account",
            "Memory",
            "Privacy",
            "Requests",
            "Preferences",
            "Audio",
            "Developer"
        ])
        XCTAssertEqual(YouSection.allCases.last, .developer)
    }
}
