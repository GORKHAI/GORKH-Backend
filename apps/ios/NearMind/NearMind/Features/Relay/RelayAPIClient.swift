import Foundation

protocol RelayAPIClientProtocol {
    func getRelayIdentity() async throws -> APIJSONResponse<RelayIdentityResponse>
    func getRelayContacts() async throws -> APIJSONResponse<RelayContactsResponse>
    func getRelayInbox() async throws -> APIJSONResponse<RelayRequestsResponse>
    func getRelayOutbox() async throws -> APIJSONResponse<RelayRequestsResponse>
    func getRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func draftRelayRequest(_ draft: RelayDraftRequest) async throws -> APIJSONResponse<RelayRequestResponse>
    func approveRelaySend(id: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func cancelRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func approveRelayRequest(id: String?, approvedPayload: [String: JSONValue]) async throws -> APIJSONResponse<RelayRequestResponse>
    func rejectRelayRequest(id: String?, reason: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func ignoreRelayRequest(id: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func blockRelaySender(id: String?, reason: String?) async throws -> APIJSONResponse<RelayRequestResponse>
    func getRelayMessages(id: String?) async throws -> APIJSONResponse<RelayMessagesResponse>
}

extension APIClient: RelayAPIClientProtocol {}
