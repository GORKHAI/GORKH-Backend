import Foundation

struct AppleVerifyRequest: Codable, Equatable {
    let identityToken: String
    let authorizationCode: String?
    let fullName: String?
    let email: String?
    let deviceLabel: String?
}

struct EmailStartRequest: Codable, Equatable {
    let email: String
}

struct EmailVerifyRequest: Codable, Equatable {
    let email: String
    let code: String
}

struct AuthTokenResponse: Codable, Equatable {
    let token: String
    let expiresAt: String?
    let account: AccountProfile
}

struct AccountProfileResponse: Codable, Equatable {
    let account: AccountProfile
}

struct AccountProfile: Codable, Equatable {
    let id: String
    let email: String?
    let displayName: String?
    let providers: [AccountProvider]
    let plan: PlanStatus
    let deletionStatus: String?
    let createdAt: String?

    var displayLabel: String {
        displayName?.isEmpty == false ? displayName! : (email ?? "NearMind account")
    }
}

struct AccountProvider: Codable, Equatable {
    let provider: String
    let email: String?
    let emailVerified: Bool?
    let displayName: String?
    let createdAt: String?
}

struct PlanStatusResponse: Codable, Equatable {
    let plan: PlanStatus
}

struct PlanStatus: Codable, Equatable {
    let planCode: String
    let status: String
    let billingEnabled: Bool
    let source: String
    let currentPeriodEnd: String?
    let displayName: String?
    let message: String?
}

struct BillingStatus: Codable, Equatable {
    let billingEnabled: Bool
    let provider: String
    let message: String
}

struct DeleteAccountRequest: Codable, Equatable {
    let reason: String?
}

struct DeleteAccountResponse: Codable, Equatable {
    let deletionRequest: [String: JSONValue]?
    let message: String?
}

struct SignOutResponse: Codable, Equatable {
    let ok: Bool
    let sessionRevoked: Bool?
    let clientClearRequired: Bool?
}
