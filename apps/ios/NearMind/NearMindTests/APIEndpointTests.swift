import XCTest
@testable import NearMind

final class APIEndpointTests: XCTestCase {
    private let baseURL = URL(string: "https://api.gorkh.com")!

    func testEndpointConstruction() throws {
        XCTAssertEqual(try Endpoint.health.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/health")
        XCTAssertEqual(try Endpoint.healthReady.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/health/ready")
        XCTAssertEqual(try Endpoint.brainDashboard.url(relativeTo: baseURL).absoluteString, "https://api.gorkh.com/brain/dashboard")
        XCTAssertEqual(try Endpoint.mobileSync(cursor: nil).absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sync")
        XCTAssertEqual(try Endpoint.mobileSync(cursor: "abc").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sync?cursor=abc")
        XCTAssertEqual(try Endpoint.mobileSessionState(sessionID: "s1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/mobile/sessions/s1/state")
        XCTAssertEqual(try Endpoint.sessionLatencySummary(sessionID: "s1").absoluteString(relativeTo: baseURL), "https://api.gorkh.com/sessions/s1/latency-summary")
    }

    func testMissingSessionIDThrows() {
        XCTAssertThrowsError(try Endpoint.mobileSessionState(sessionID: nil).url(relativeTo: baseURL))
        XCTAssertThrowsError(try Endpoint.sessionLatencySummary(sessionID: "").url(relativeTo: baseURL))
    }
}

private extension Endpoint {
    func absoluteString(relativeTo baseURL: URL) throws -> String {
        try url(relativeTo: baseURL).absoluteString
    }
}
