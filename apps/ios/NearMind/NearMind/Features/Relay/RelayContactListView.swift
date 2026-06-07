import SwiftUI

struct RelayContactListView: View {
    @StateObject private var viewModel: RelayViewModel

    init(client: RelayAPIClientProtocol) {
        _viewModel = StateObject(wrappedValue: RelayViewModel(client: client))
    }

    var body: some View {
        List {
            if viewModel.contacts.isEmpty && !viewModel.isLoading {
                NativeEmptyRow(title: "No trusted contacts", subtitle: "Contacts are created when you draft private requests.")
            } else {
                ForEach(viewModel.contacts) { contact in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(contact.displayName)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(NearMindTheme.textPrimary)
                            Spacer()
                            Text(contact.status.capitalized)
                                .font(.caption)
                                .foregroundStyle(NearMindTheme.textSecondary)
                        }
                        Text([contact.companyName, contact.relationship, contact.email].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(NearMindTheme.textSecondary)
                    }
                }
            }

            if let statusMessage = viewModel.statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .listRowBackground(NearMindTheme.elevatedBackground)
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Trusted Contacts")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load()
        }
    }
}

struct RelayIdentityView: View {
    @State private var identity: [String: JSONValue] = [:]
    @State private var statusMessage: String?
    let client: RelayAPIClientProtocol

    var body: some View {
        List {
            Section("Request identity") {
                LabeledContent("Name", value: identity["displayName"]?.stringValue ?? "Not set")
                LabeledContent("Visibility", value: identity["profileVisibility"]?.stringValue ?? "private")
                LabeledContent("Enabled", value: (identity["relayEnabled"]?.boolValue ?? true) ? "Yes" : "No")
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Privacy") {
                ProfileRow(title: "Private by default", subtitle: "Memory and profile details are never exposed automatically.", systemImage: "lock")
                ProfileRow(title: "Limited request identity", subtitle: "Only your display identity is used for controlled requests.", systemImage: "person.crop.circle.badge.checkmark")
            }
            .listRowBackground(NearMindTheme.cardSurface)

            if let statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .listRowBackground(NearMindTheme.elevatedBackground)
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Request Identity")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await load()
        }
    }

    private func load() async {
        do {
            identity = try await client.getRelayIdentity().decoded?.identity ?? [:]
            statusMessage = nil
        } catch {
            statusMessage = (error as? LocalizedError)?.errorDescription ?? "Could not load Relay identity."
        }
    }
}
