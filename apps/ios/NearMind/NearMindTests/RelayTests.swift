import XCTest
@testable import NearMind

@MainActor
final class RelayTests: XCTestCase {
    func testRelayModelsDecode() throws {
        let data = Data("""
        {
          "requests": [{
            "id": "request-1",
            "requestType": "availability_request",
            "title": "Availability check for Steve",
            "summary": "Ask Steve if next week works.",
            "requestedShare": {},
            "riskLevel": "low",
            "status": "pending_sender_approval",
            "expiresAt": null,
            "createdAt": "2026-06-05T10:00:00.000Z",
            "updatedAt": "2026-06-05T10:00:00.000Z",
            "direction": "outbox"
          }]
        }
        """.utf8)

        let decoded = try JSONDecoder().decode(RelayRequestsResponse.self, from: data)

        XCTAssertEqual(decoded.requests.first?.id, "request-1")
        XCTAssertEqual(decoded.requests.first?.displayStatus, "Needs approval")
        XCTAssertEqual(decoded.requests.first?.direction, "outbox")
    }

    func testRelayDraftPayloadDoesNotSendUserID() throws {
        let draft = RelayDraftRequest(
            requestType: .investorInterestCheck,
            recipient: .init(contactId: nil, email: "investor@example.com", displayName: "Investor"),
            goal: "Ask whether they want to review the deck.",
            context: ["source": JSONValue("unit_test")],
            requestedShare: [:]
        )

        let json = String(decoding: try JSONEncoder().encode(draft), as: UTF8.self)

        XCTAssertTrue(json.contains("investor_interest_check"))
        XCTAssertFalse(json.contains("userId"))
        XCTAssertFalse(json.contains("fromUserId"))
        XCTAssertFalse(json.contains("toUserId"))
    }

    func testMobileSyncRelayItemDecodes() throws {
        let data = Data("""
        {
          "cursor": null,
          "hasMore": false,
          "items": [{
            "type": "relay_request_received",
            "item": {
              "id": "request-1",
              "title": "New agent request",
              "status": "sent"
            }
          }]
        }
        """.utf8)

        let decoded = try JSONDecoder().decode(MobileSyncResponse.self, from: data)

        XCTAssertEqual(decoded.items.first?.type, "relay_request_received")
        XCTAssertEqual(decoded.items.first?.item["id"]?.stringValue, "request-1")
    }

    func testApprovalCardCallsApproveSendEndpoint() async {
        let client = MockRelayAPIClient()
        let viewModel = RelayViewModel(client: client)
        let request = RelayRequestSummary.fixture(status: "pending_sender_approval")

        await viewModel.approveSend(request)

        XCTAssertEqual(client.approveSendIDs, ["request-1"])
    }

    func testViewModelLoadsInboxOutboxAndContacts() async {
        let client = MockRelayAPIClient()
        client.inbox = [.fixture(id: "inbox-1", status: "sent", direction: "inbox")]
        client.outbox = [.fixture(id: "outbox-1", status: "pending_sender_approval", direction: "outbox")]
        client.contacts = [.init(id: "contact-1", displayName: "Steve", email: nil, companyName: nil, relationship: nil, status: "trusted", trustLevel: "standard")]
        let viewModel = RelayViewModel(client: client)

        await viewModel.load()

        XCTAssertEqual(viewModel.inbox.map(\.id), ["inbox-1"])
        XCTAssertEqual(viewModel.outbox.map(\.id), ["outbox-1"])
        XCTAssertEqual(viewModel.contacts.map(\.displayName), ["Steve"])
    }
}

private extension RelayRequestSummary {
    static func fixture(id: String = "request-1", status: String, direction: String = "outbox") -> RelayRequestSummary {
        RelayRequestSummary(
            id: id,
            requestType: "availability_request",
            title: "Availability check",
            summary: "Ask if next week works.",
            requestedShare: [:],
            riskLevel: "low",
            status: status,
            expiresAt: nil,
            createdAt: nil,
            updatedAt: nil,
            direction: direction
        )
    }
}

private final class MockRelayAPIClient: RelayAPIClientProtocol {
    var inbox: [RelayRequestSummary] = []
    var outbox: [RelayRequestSummary] = []
    var contacts: [RelayContact] = []
    var approveSendIDs: [String] = []

    func getRelayIdentity() async throws -> APIJSONResponse<RelayIdentityResponse> {
        return APIJSONResponse(decoded: RelayIdentityResponse(identity: [:]), raw: [:], rawJSON: "{}")
    }

    func getRelayContacts() async throws -> APIJSONResponse<RelayContactsResponse> {
        return APIJSONResponse(decoded: RelayContactsResponse(contacts: contacts), raw: [:], rawJSON: "{}")
    }

    func getRelayInbox() async throws -> APIJSONResponse<RelayRequestsResponse> {
        return APIJSONResponse(decoded: RelayRequestsResponse(requests: inbox), raw: [:], rawJSON: "{}")
    }

    func getRelayOutbox() async throws -> APIJSONResponse<RelayRequestsResponse> {
        return APIJSONResponse(decoded: RelayRequestsResponse(requests: outbox), raw: [:], rawJSON: "{}")
    }

    func getRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "sent"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func draftRelayRequest(_ draft: RelayDraftRequest) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "pending_sender_approval"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func approveRelaySend(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        approveSendIDs.append(id ?? "")
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "sent"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func cancelRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "canceled"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func approveRelayRequest(id: String?, approvedPayload: [String: JSONValue]) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "approved"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func rejectRelayRequest(id: String?, reason: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "rejected"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func ignoreRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "ignored"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func blockRelaySender(id: String?, reason: String?) async throws -> APIJSONResponse<RelayRequestResponse> {
        return APIJSONResponse(decoded: RelayRequestResponse(request: .fixture(status: "blocked"), approvalCard: nil), raw: [:], rawJSON: "{}")
    }

    func getRelayMessages(id: String?) async throws -> APIJSONResponse<RelayMessagesResponse> {
        return APIJSONResponse(decoded: RelayMessagesResponse(messages: []), raw: [:], rawJSON: "{}")
    }
}
