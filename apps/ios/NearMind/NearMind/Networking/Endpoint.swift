import Foundation

enum Endpoint: Equatable {
    case health
    case brainDashboard
    case mobileSync(cursor: String?)
    case mobileSessionState(sessionID: String?)

    func url(relativeTo baseURL: URL) throws -> URL {
        switch self {
        case .health:
            return baseURL.appending(path: "health")
        case .brainDashboard:
            return baseURL.appending(path: "brain/dashboard")
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
        }
    }
}
