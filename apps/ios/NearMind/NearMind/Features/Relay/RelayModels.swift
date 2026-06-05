import Foundation

enum RelayRequestStatus: String, Codable, CaseIterable {
    case draft
    case pendingSenderApproval = "pending_sender_approval"
    case sent
    case received
    case approved
    case rejected
    case ignored
    case blocked
    case expired
    case canceled

    var displayName: String {
        switch self {
        case .pendingSenderApproval:
            return "Needs approval"
        default:
            return rawValue.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

enum RelayRiskLevel: String, Codable {
    case low
    case medium
    case high
}

enum RelayRequestType: String, Codable, CaseIterable {
    case introRequest = "intro_request"
    case meetingRequest = "meeting_request"
    case availabilityRequest = "availability_request"
    case investorInterestCheck = "investor_interest_check"
    case jobOpportunity = "job_opportunity"
    case collaborationRequest = "collaboration_request"
    case teamUpdateRequest = "team_update_request"
    case roomInvite = "room_invite"
    case documentReviewRequest = "document_review_request"
    case followUpRequest = "follow_up_request"
    case generalRequest = "general_request"

    var displayName: String {
        switch self {
        case .investorInterestCheck:
            return "Investor interest"
        case .availabilityRequest:
            return "Availability"
        case .jobOpportunity:
            return "Role opportunity"
        case .meetingRequest:
            return "Meeting"
        default:
            return rawValue.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

struct RelayRequestSummary: Codable, Identifiable, Equatable {
    let id: String
    let requestType: String
    let title: String
    let summary: String
    let requestedShare: [String: JSONValue]?
    let riskLevel: String
    let status: String
    let expiresAt: String?
    let createdAt: String?
    let updatedAt: String?
    let direction: String?

    var displayStatus: String {
        RelayRequestStatus(rawValue: status)?.displayName ?? status.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

struct RelayContact: Codable, Identifiable, Equatable {
    let id: String
    let displayName: String
    let email: String?
    let companyName: String?
    let relationship: String?
    let status: String
    let trustLevel: String
}

struct RelayMessage: Codable, Identifiable, Equatable {
    let id: String
    let requestId: String
    let role: String
    let body: String
    let safeForRecipient: Bool?
    let createdAt: String?
}

struct RelayIdentityResponse: Codable, Equatable {
    let identity: [String: JSONValue]
}

struct RelayRequestsResponse: Codable, Equatable {
    let requests: [RelayRequestSummary]
}

struct RelayRequestResponse: Codable, Equatable {
    let request: RelayRequestSummary
    let approvalCard: RelayApprovalCardPayload?
}

struct RelayContactsResponse: Codable, Equatable {
    let contacts: [RelayContact]
}

struct RelayMessagesResponse: Codable, Equatable {
    let messages: [RelayMessage]
}

struct RelayApprovalCardPayload: Codable, Equatable {
    let type: String
    let requestId: String
    let title: String
    let summary: String
    let confirmLabel: String
    let cancelLabel: String
}

struct RelayDecisionRequest: Codable, Equatable {
    let reason: String?
    let approvedPayload: [String: JSONValue]?

    init(reason: String? = nil, approvedPayload: [String: JSONValue]? = nil) {
        self.reason = reason
        self.approvedPayload = approvedPayload
    }
}

struct RelayMessageRequest: Codable, Equatable {
    let body: String
}

struct RelayDraftRequest: Codable, Equatable {
    struct Recipient: Codable, Equatable {
        let contactId: String?
        let email: String?
        let displayName: String?
    }

    let requestType: RelayRequestType
    let recipient: Recipient
    let goal: String
    let context: [String: JSONValue]?
    let requestedShare: [String: JSONValue]?
}
