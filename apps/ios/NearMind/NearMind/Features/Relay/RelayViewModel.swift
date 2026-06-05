import Foundation

@MainActor
final class RelayViewModel: ObservableObject {
    @Published private(set) var inbox: [RelayRequestSummary] = []
    @Published private(set) var outbox: [RelayRequestSummary] = []
    @Published private(set) var contacts: [RelayContact] = []
    @Published private(set) var messages: [RelayMessage] = []
    @Published private(set) var selectedRequest: RelayRequestSummary?
    @Published private(set) var isLoading = false
    @Published private(set) var statusMessage: String?

    private let client: RelayAPIClientProtocol

    init(client: RelayAPIClientProtocol) {
        self.client = client
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let inboxResponse = client.getRelayInbox()
            async let outboxResponse = client.getRelayOutbox()
            async let contactsResponse = client.getRelayContacts()
            inbox = try await inboxResponse.decoded?.requests ?? []
            outbox = try await outboxResponse.decoded?.requests ?? []
            contacts = try await contactsResponse.decoded?.contacts ?? []
            statusMessage = nil
        } catch {
            statusMessage = safeError(error)
        }
    }

    func select(_ request: RelayRequestSummary) async {
        selectedRequest = request
        do {
            messages = try await client.getRelayMessages(id: request.id).decoded?.messages ?? []
        } catch {
            messages = []
            statusMessage = safeError(error)
        }
    }

    func draft(type: RelayRequestType, displayName: String, email: String?, goal: String) async -> RelayRequestSummary? {
        let request = RelayDraftRequest(
            requestType: type,
            recipient: RelayDraftRequest.Recipient(
                contactId: nil,
                email: email?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ),
            goal: goal,
            context: ["source": JSONValue("ios_relay_composer")],
            requestedShare: [:]
        )
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await client.draftRelayRequest(request)
            if let relayRequest = response.decoded?.request {
                selectedRequest = relayRequest
                statusMessage = "Draft created. Review before sending."
                await load()
                return relayRequest
            }
            statusMessage = "Draft created, but NearMind could not decode the response."
        } catch {
            statusMessage = safeError(error)
        }
        return nil
    }

    func approveSend(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.approveRelaySend(id: request.id).decoded?.request
        }
    }

    func cancel(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.cancelRelayRequest(id: request.id).decoded?.request
        }
    }

    func approveIncoming(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.approveRelayRequest(id: request.id, approvedPayload: [:]).decoded?.request
        }
    }

    func rejectIncoming(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.rejectRelayRequest(id: request.id, reason: nil).decoded?.request
        }
    }

    func ignoreIncoming(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.ignoreRelayRequest(id: request.id).decoded?.request
        }
    }

    func blockSender(_ request: RelayRequestSummary) async {
        await mutate {
            try await client.blockRelaySender(id: request.id, reason: "blocked_from_ios").decoded?.request
        }
    }

    private func mutate(_ operation: () async throws -> RelayRequestSummary?) async {
        isLoading = true
        defer { isLoading = false }
        do {
            selectedRequest = try await operation() ?? selectedRequest
            statusMessage = "Updated."
            await load()
        } catch {
            statusMessage = safeError(error)
        }
    }

    private func safeError(_ error: Error) -> String {
        if let localized = (error as? LocalizedError)?.errorDescription {
            return localized
        }
        return "Relay request failed safely."
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
