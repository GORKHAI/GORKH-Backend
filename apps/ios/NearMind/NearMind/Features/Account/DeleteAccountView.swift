import SwiftUI

struct DeleteAccountView: View {
    @EnvironmentObject private var appState: AppState
    @State private var reason = ""
    @State private var message: String?
    @State private var isWorking = false

    var body: some View {
        Form {
            Section("Request deletion") {
                Text("Account deletion is a serious action. In this alpha, this sends a deletion request to the backend.")
                    .foregroundStyle(NearMindTheme.textSecondary)
                TextField("Reason (optional)", text: $reason, axis: .vertical)
                    .lineLimit(3, reservesSpace: true)
                Button(role: .destructive) {
                    requestDeletion()
                } label: {
                    Label("Request account deletion", systemImage: "person.crop.circle.badge.xmark")
                }
                .disabled(isWorking)
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section {
                Button {
                    cancelDeletion()
                } label: {
                    Label("Cancel pending deletion request", systemImage: "arrow.uturn.backward")
                }
                .disabled(isWorking)

                if let message {
                    Text(message)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Delete Account")
    }

    private func requestDeletion() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                let response = try await appState.environment.apiClient.requestAccountDeletion(DeleteAccountRequest(reason: reason.isEmpty ? nil : reason))
                message = response.decoded?.message ?? "Deletion request recorded."
                await appState.refreshAccount()
            } catch {
                message = error.localizedDescription
            }
        }
    }

    private func cancelDeletion() {
        isWorking = true
        Task {
            defer { isWorking = false }
            do {
                let response = try await appState.environment.apiClient.cancelAccountDeletion()
                message = response.decoded?.message ?? "Deletion request updated."
                await appState.refreshAccount()
            } catch {
                message = error.localizedDescription
            }
        }
    }
}
