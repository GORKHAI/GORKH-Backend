import Foundation

struct MobileError: Codable, Equatable {
    let code: String
    let message: String
    let retryable: Bool
    let details: [String: JSONValue]?
}
