import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section("Account") {
                LabeledContent("Signed in as", value: appState.account?.displayLabel ?? "Unknown")
                LabeledContent("Email", value: appState.account?.email ?? "Not provided")
                Button(role: .destructive) {
                    Task { await appState.signOut() }
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Plan") {
                PlanStatusView(plan: appState.account?.plan, billing: appState.billingStatus)
                    .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Privacy & Data") {
                NavigationLink {
                    DeleteAccountView()
                } label: {
                    ProfileRow(title: "Account deletion", subtitle: appState.account?.deletionStatus ?? "No pending request", systemImage: "person.crop.circle.badge.xmark")
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Account")
        .task {
            await appState.refreshAccount()
        }
    }
}
