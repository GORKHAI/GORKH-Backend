import XCTest
@testable import NearMind

final class StartPayloadEncodingTests: XCTestCase {
    func testStartPayloadEncodesRequiredFields() throws {
        let payload = StartSessionPayload(
            policy: .conversationAgent,
            situationDescription: "Bank loan meeting",
            title: "Loan prep",
            consent: true
        )

        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let input = try XCTUnwrap(object["input"] as? [String: Any])
        let output = try XCTUnwrap(object["output"] as? [String: Any])

        XCTAssertEqual(object["type"] as? String, "start")
        XCTAssertEqual(object["protocolVersion"] as? Int, 1)
        XCTAssertEqual(object["policy"] as? String, "conversation_agent")
        XCTAssertEqual(object["consent"] as? Bool, true)
        XCTAssertEqual(input["kind"] as? String, "text")
        XCTAssertEqual(output["kind"] as? String, "both")
        XCTAssertEqual(object["retentionPolicy"] as? String, "ask_on_stop")
        XCTAssertNil(object["userId"])
    }

    func testWhisperPolicyEncodesCorrectly() throws {
        let payload = StartSessionPayload(
            policy: .whisperCopilot,
            situationDescription: "Loan terms",
            title: "APR review",
            consent: true
        )

        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["policy"] as? String, "whisper_copilot")
    }
}
