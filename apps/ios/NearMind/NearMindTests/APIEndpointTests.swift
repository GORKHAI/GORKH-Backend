import XCTest
@testable import NearMind

final class APIEndpointTests: XCTestCase {
    private let baseURL = URL(string: "https://api.gorkh.com")!

    func testEndpointConstruction() throws {
        XCTAssertEqual(try Endpoint.health.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/health")
        XCTAssertEqual(try Endpoint.healthReady.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/health/ready")
        XCTAssertEqual(try Endpoint.brainDashboard.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/brain/dashboard")
        XCTAssertEqual(try Endpoint.brainQuery.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/brain/query")
        XCTAssertEqual(try Endpoint.humanProfileReview.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/human/profile/review")
        XCTAssertEqual(try Endpoint.mobileSync(cursor: nil).absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sync")
        XCTAssertEqual(try Endpoint.mobileSync(cursor: "abc").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sync?cursor=abc")
        XCTAssertEqual(try Endpoint.mobileSessionState(sessionID: "s1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sessions/s1/state")
        XCTAssertEqual(try Endpoint.sessionLatencySummary(sessionID: "s1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/sessions/s1/latency-summary")
        XCTAssertEqual(try Endpoint.relayIdentity.absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/identity")
        XCTAssertEqual(try Endpoint.relayContacts.absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/contacts")
        XCTAssertEqual(try Endpoint.relayInbox.absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/inbox")
        XCTAssertEqual(try Endpoint.relayOutbox.absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/outbox")
        XCTAssertEqual(try Endpoint.relayDraftRequest.absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/draft")
        XCTAssertEqual(try Endpoint.relayRequest(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1")
        XCTAssertEqual(try Endpoint.relayApproveSend(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/approve-send")
        XCTAssertEqual(try Endpoint.relayCancel(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/cancel")
        XCTAssertEqual(try Endpoint.relayApprove(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/approve")
        XCTAssertEqual(try Endpoint.relayReject(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/reject")
        XCTAssertEqual(try Endpoint.relayIgnore(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/ignore")
        XCTAssertEqual(try Endpoint.relayBlockSender(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/block-sender")
        XCTAssertEqual(try Endpoint.relayMessages(id: "r1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/relay/requests/r1/messages")
    }

    func testMissingSessionIDThrows() {
        XCTAssertThrowsError(try Endpoint.mobileSessionState(sessionID: nil).url(relativeTo: baseURL))
        XCTAssertThrowsError(try Endpoint.sessionLatencySummary(sessionID: "").url(relativeTo: baseURL))
        XCTAssertThrowsError(try Endpoint.relayRequest(id: nil).url(relativeTo: baseURL))
        XCTAssertThrowsError(try Endpoint.relayApproveSend(id: "").url(relativeTo: baseURL))
    }
}

private extension Endpoint {
    func absoluteString(relativeTo baseURL: URL) throws -> String {
        try url(relativeTo: baseURL).absoluteString
    }
}
