import XCTest
@testable import NearMind

final class LiveSmokeDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testMobileSyncDecoding() throws {
        let json = #"{"cursor":"c1","hasMore":false,"items":[{"type":"session","item":{"id":"s1","status":"stopped","retentionPolicy":"ask_on_stop"}}]}"#
        let decoded = try decoder.decode(MobileSyncResponse.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.cursor, "c1")
        XCTAssertFalse(decoded.hasMore ?? true)
        XCTAssertEqual(decoded.items.first?.type, "session")
        XCTAssertEqual(decoded.items.first?.item["id"], JSONValue("s1"))
    }

    func testSessionStateDecoding() throws {
        let json = #"{"sessionId":"s1","status":"stopped","voiceState":{"voiceSessionId":"v1","state":"stopped","policy":"conversation_agent","inputKind":"text","outputKind":"both"},"retentionPolicy":"ask_on_stop","counts":{"voiceOutputs":1},"canResume":false,"resumeReason":"mobile_v0_read_only_resume_state","lastEventCursor":null}"#
        let decoded = try decoder.decode(SessionStateResponse.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.sessionId, "s1")
        XCTAssertEqual(decoded.voiceState?.voiceSessionId, "v1")
        XCTAssertEqual(decoded.counts?["voiceOutputs"], JSONValue(1))
        XCTAssertFalse(decoded.canResume ?? true)
    }

    func testLatencySummaryDecoding() throws {
        let json = #"{"sessionId":"s1","latencySummary":{"asrToCueMs":100,"cueToGatewayInstructionMs":40}}"#
        let decoded = try decoder.decode(LatencySummaryResponse.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.sessionId, "s1")
        XCTAssertEqual(decoded.latencySummary["asrToCueMs"], JSONValue(100))
    }
}
