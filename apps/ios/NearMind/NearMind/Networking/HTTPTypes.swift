import Foundation

enum HTTPMethod: String {
    case get = "GET"
}

enum APIClientError: Error, Equatable, LocalizedError {
    case invalidResponse
    case httpStatus(Int)
    case missingSessionID

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpStatus(let status):
            return "The server returned HTTP \(status)."
        case .missingSessionID:
            return "A session ID is required for this endpoint."
        }
    }
}

struct EmptyResponse: Codable, Equatable {}
