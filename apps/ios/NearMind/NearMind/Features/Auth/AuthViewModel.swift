import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    enum Mode: Equatable {
        case welcome
        case email
        case developerToken
    }

    @Published var mode: Mode = .welcome
    @Published var email = ""
    @Published var developerToken = ""
    @Published private(set) var statusMessage: String?
    @Published private(set) var isWorking = false

    private let appState: AppState
    private let apiClient: APIClient

    init(appState: AppState) {
        self.appState = appState
        self.apiClient = appState.environment.apiClient
    }

    func signInWithApple(identityToken: String, authorizationCode: String?, fullName: String?, email: String?) {
        isWorking = true
        statusMessage = nil
        Task {
            defer { self.isWorking = false }
            do {
                let response = try await apiClient.verifyAppleSignIn(
                    AppleVerifyRequest(
                        identityToken: identityToken,
                        authorizationCode: authorizationCode,
                        fullName: fullName,
                        email: email,
                        deviceLabel: "iPhone"
                    )
                )
                guard let auth = response.decoded else {
                    self.statusMessage = "The server response could not be decoded."
                    return
                }
                try appState.saveAuthenticatedToken(auth.token)
                appState.account = auth.account
                statusMessage = "Signed in."
            } catch {
                statusMessage = userFacingMessage(for: error)
            }
        }
    }

    func startEmailSignIn() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty else {
            statusMessage = "Enter an email address."
            return
        }
        isWorking = true
        statusMessage = nil
        Task {
            defer { self.isWorking = false }
            do {
                _ = try await apiClient.startEmailSignIn(EmailStartRequest(email: cleanEmail))
                statusMessage = "Check your email for a sign-in code."
            } catch {
                statusMessage = userFacingMessage(for: error)
            }
        }
    }

    func saveDeveloperToken() {
        let token = developerToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            statusMessage = "Paste a test JWT first."
            return
        }
        do {
            try appState.saveAuthenticatedToken(token)
            developerToken = ""
            statusMessage = "Token saved."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func userFacingMessage(for error: Error) -> String {
        if let clientError = error as? APIClientError {
            switch clientError.mobileErrorCode {
            case "apple_sign_in_not_enabled":
                return "Sign in with Apple is not enabled in this alpha."
            case "email_auth_not_enabled", "email_provider_not_configured":
                return "Email sign-in is not enabled in this alpha."
            default:
                return clientError.localizedDescription
            }
        }
        return error.localizedDescription
    }
}
