import XCTest
@testable import NearMind

final class StartPayloadEncodingTests: XCTestCase {
    func testStartPayloadEncodesRequiredFields() throws {
        let payload = StartSessionPayload(
            policy: .conversationAgent,
            situationDescription: "Bank loan meeting",
            title: "Loan prep",
            consentGranted: true
        )

        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let consent = try XCTUnwrap(object["consent"] as? [String: Any])
        let input = try XCTUnwrap(object["input"] as? [String: Any])
        let output = try XCTUnwrap(object["output"] as? [String: Any])

        XCTAssertEqual(object["type"] as? String, "start")
        XCTAssertEqual(object["protocolVersion"] as? Int, 1)
        XCTAssertEqual(object["policy"] as? String, "conversation_agent")
        XCTAssertEqual(consent["granted"] as? Bool, true)
        XCTAssertEqual(consent["method"] as? String, "user_tap")
        XCTAssertEqual(consent["noticeText"] as? String, "Live Assist is active. I confirm I have the right consent for this conversation.")
        XCTAssertEqual(consent["participantCount"] as? Int, 1)
        XCTAssertEqual(consent["jurisdiction"] as? String, "unknown")
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
            consentGranted: true
        )

        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let consent = try XCTUnwrap(object["consent"] as? [String: Any])
        XCTAssertEqual(object["policy"] as? String, "whisper_copilot")
        XCTAssertEqual(consent["participantCount"] as? Int, 2)
    }
}
