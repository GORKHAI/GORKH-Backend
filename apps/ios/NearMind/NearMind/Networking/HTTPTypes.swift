import Foundation

enum HTTPMethod: String {
    case get = "GET"
}

enum APIClientError: Error, Equatable, LocalizedError {
    case invalidResponse
    case httpStatus(Int, MobileError?)
    case missingSessionID
    case invalidJSON

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpStatus(let status, let error):
            if let error {
                return "\(error.code): \(error.message)"
            }
            return "The server returned HTTP \(status)."
        case .missingSessionID:
            return "A session ID is required for this endpoint."
        case .invalidJSON:
            return "The server returned JSON NearMind could not decode."
        }
    }

    var mobileErrorCode: String? {
        if case .httpStatus(_, let error) = self {
            return error?.code
        }
        return nil
    }
}

struct EmptyResponse: Codable, Equatable {}
