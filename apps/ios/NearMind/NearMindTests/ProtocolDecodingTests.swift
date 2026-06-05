import XCTest
@testable import NearMind

final class ProtocolDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testDecodesGatewayAck() throws {
        let event = try decode(#"{"type":"gateway_ack","sessionId":"s1"}"#)
        guard case .gatewayAck(let payload) = event else {
            return XCTFail("Expected gateway_ack")
        }
        XCTAssertEqual(payload["sessionId"], JSONValue("s1"))
    }

    func testDecodesVoiceCue() throws {
        let event = try decode(#"{"type":"voice_cue","text":"Ask about fees"}"#)
        guard case .voiceCue(let payload) = event else {
            return XCTFail("Expected voice_cue")
        }
        XCTAssertEqual(payload["text"], JSONValue("Ask about fees"))
    }

    func testDecodesVoiceAssistantText() throws {
        let event = try decode(#"{"type":"voice_assistant_text","text":"Prepare a repayment question."}"#)
        guard case .voiceAssistantText(let payload) = event else {
            return XCTFail("Expected voice_assistant_text")
        }
        XCTAssertEqual(payload["text"], JSONValue("Prepare a repayment question."))
    }

    func testDecodesStableErrorCode() throws {
        let event = try decode(#"{"type":"error","code":"voice_auth_required","message":"Auth required","retryable":false,"details":{"reason":"missing_token"}}"#)
        guard case .error(let error) = event else {
            return XCTFail("Expected error")
        }
        XCTAssertEqual(error.code, "voice_auth_required")
        XCTAssertEqual(error.message, "Auth required")
        XCTAssertFalse(error.retryable)
        XCTAssertEqual(error.details?["reason"], JSONValue("missing_token"))
    }

    func testUnknownEventDoesNotCrash() throws {
        let event = try decode(#"{"type":"future_event","value":42}"#)
        guard case .unknown(let type, let payload) = event else {
            return XCTFail("Expected unknown event")
        }
        XCTAssertEqual(type, "future_event")
        XCTAssertEqual(payload["value"], JSONValue(42))
    }

    private func decode(_ json: String) throws -> GatewayServerEvent {
        try decoder.decode(GatewayServerEvent.self, from: Data(json.utf8))
    }
}
