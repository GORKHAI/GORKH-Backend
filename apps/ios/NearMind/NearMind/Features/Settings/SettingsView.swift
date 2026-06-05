import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var token = ""
    @State private var statusMessage: String?

    var body: some View {
        Form {
            Section("Authentication") {
                SecureField("Paste test JWT", text: $token)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Button {
                    saveToken()
                } label: {
                    Label("Save token to Keychain", systemImage: "key")
                }
                .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Button(role: .destructive) {
                    clearToken()
                } label: {
                    Label("Clear token / logout", systemImage: "rectangle.portrait.and.arrow.right")
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Environment") {
                LabeledContent("Production API", value: appState.environment.config.apiBaseURL.absoluteString)
                LabeledContent("Production Gateway", value: appState.environment.config.gatewayWebSocketURL.absoluteString)
                LabeledContent("Gateway HTTP", value: appState.environment.config.gatewayHTTPURL.absoluteString)
            }

            Section("Security posture") {
                Label("JWTs are stored only in Keychain.", systemImage: "lock.shield")
                Label("Provider keys and API secrets do not belong in the app.", systemImage: "exclamationmark.shield")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.black.ignoresSafeArea())
        .navigationTitle("Settings")
        .onAppear {
            appState.refreshAuthStatus()
        }
    }

    private func saveToken() {
        do {
            try appState.environment.tokenStore.saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
            token = ""
            statusMessage = "Token saved."
            appState.refreshAuthStatus()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func clearToken() {
        do {
            try appState.environment.tokenStore.clearToken()
            statusMessage = "Token cleared."
            appState.refreshAuthStatus()
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
