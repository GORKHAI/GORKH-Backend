import Foundation

enum Endpoint: Equatable {
    case health
    case healthReady
    case brainDashboard
    case brainQuery
    case humanProfileReview
    case authAppleVerify
    case authEmailStart
    case authEmailVerify
    case accountMe
    case accountSignOut
    case accountDeleteRequest
    case accountDeleteCancel
    case planMe
    case billingStatus
    case mobileSync(cursor: String?)
    case mobileSessionState(sessionID: String?)
    case sessionLatencySummary(sessionID: String?)
    case relayIdentity
    case relayContacts
    case relayInbox
    case relayOutbox
    case relayRequest(id: String?)
    case relayDraftRequest
    case relayApproveSend(id: String?)
    case relayCancel(id: String?)
    case relayApprove(id: String?)
    case relayReject(id: String?)
    case relayIgnore(id: String?)
    case relayBlockSender(id: String?)
    case relayMessages(id: String?)

    func url(relativeTo baseURL: URL) throws -> URL {
        switch self {
        case .health:
            return baseURL.appending(path: "health")
        case .healthReady:
            return baseURL.appending(path: "health/ready")
        case .brainDashboard:
            return baseURL.appending(path: "brain/dashboard")
        case .brainQuery:
            return baseURL.appending(path: "brain/query")
        case .humanProfileReview:
            return baseURL.appending(path: "human/profile/review")
        case .authAppleVerify:
            return baseURL.appending(path: "auth/apple/verify")
        case .authEmailStart:
            return baseURL.appending(path: "auth/email/start")
        case .authEmailVerify:
            return baseURL.appending(path: "auth/email/verify")
        case .accountMe:
            return baseURL.appending(path: "account/me")
        case .accountSignOut:
            return baseURL.appending(path: "account/sign-out")
        case .accountDeleteRequest:
            return baseURL.appending(path: "account/delete-request")
        case .accountDeleteCancel:
            return baseURL.appending(path: "account/delete-cancel")
        case .planMe:
            return baseURL.appending(path: "plans/me")
        case .billingStatus:
            return baseURL.appending(path: "billing/status")
        case .mobileSync(let cursor):
            var components = URLComponents(url: baseURL.appending(path: "mobile/sync"), resolvingAgainstBaseURL: false)!
            if let cursor, !cursor.isEmpty {
                components.queryItems = [URLQueryItem(name: "cursor", value: cursor)]
            }
            return components.url!
        case .mobileSessionState(let sessionID):
            guard let sessionID, !sessionID.isEmpty else {
                throw APIClientError.missingSessionID
            }
            return baseURL.appending(path: "mobile/sessions/\(sessionID)/state")
        case .sessionLatencySummary(let sessionID):
            guard let sessionID, !sessionID.isEmpty else {
                throw APIClientError.missingSessionID
            }
            return baseURL.appending(path: "sessions/\(sessionID)/latency-summary")
        case .relayIdentity:
            return baseURL.appending(path: "relay/identity")
        case .relayContacts:
            return baseURL.appending(path: "relay/contacts")
        case .relayInbox:
            return baseURL.appending(path: "relay/requests/inbox")
        case .relayOutbox:
            return baseURL.appending(path: "relay/requests/outbox")
        case .relayRequest(let id):
            return try relayPath(baseURL: baseURL, id: id)
        case .relayDraftRequest:
            return baseURL.appending(path: "relay/requests/draft")
        case .relayApproveSend(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "approve-send")
        case .relayCancel(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "cancel")
        case .relayApprove(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "approve")
        case .relayReject(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "reject")
        case .relayIgnore(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "ignore")
        case .relayBlockSender(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "block-sender")
        case .relayMessages(let id):
            return try relayPath(baseURL: baseURL, id: id, suffix: "messages")
        }
    }

    private func relayPath(baseURL: URL, id: String?, suffix: String? = nil) throws -> URL {
        guard let id, !id.isEmpty else {
            throw APIClientError.missingRelayRequestID
        }
        if let suffix {
            return baseURL.appending(path: "relay/requests/\(id)/\(suffix)")
        }
        return baseURL.appending(path: "relay/requests/\(id)")
    }
}
