import SwiftUI

struct StorageView: View {
    @EnvironmentObject private var appState: AppState
    @State private var status: StorageStatus?
    @State private var usage: StorageUsage?
    @State private var objects: [StorageObjectSummary] = []
    @State private var message: String?
    @State private var isLoading = false
    @State private var latestDownloadURL: String?

    var body: some View {
        List {
            Section("Long-term storage") {
                LabeledContent("Provider", value: status?.provider.uppercased() ?? "Loading")
                LabeledContent("Configured", value: status?.configured == true ? "Yes" : "No")
                LabeledContent("Fair-use limits", value: "Apply")
                LabeledContent("Raw audio", value: status?.audioSaveDefault == true ? "Opt-in enabled" : "Off by default")
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Usage") {
                usageRow("Total", bytes: usage?.totalBytes ?? 0)
                usageRow("Transcripts", bytes: usage?.transcriptBytes ?? 0)
                usageRow("Documents", bytes: usage?.documentBytes ?? 0)
                usageRow("Reports", bytes: usage?.reportBytes ?? 0)
                usageRow("Exports", bytes: usage?.exportBytes ?? 0)
                usageRow("Audio", bytes: usage?.audioBytes ?? 0)
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Objects") {
                if objects.isEmpty {
                    ProfileRow(title: "No saved objects yet", subtitle: "Saved transcripts, reports, exports, and documents will appear here.", systemImage: "archivebox")
                } else {
                    ForEach(objects.prefix(20)) { object in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(object.objectType.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.headline)
                                    .foregroundStyle(NearMindTheme.textPrimary)
                                Spacer()
                                Text(object.status.capitalized)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(NearMindTheme.textSecondary)
                            }
                            Text("\(object.ownerType.capitalized) · \(formatBytes(Double(object.sizeBytes ?? 0))) · \(object.retentionPolicy.replacingOccurrences(of: "_", with: " "))")
                                .font(.caption)
                                .foregroundStyle(NearMindTheme.textSecondary)
                        }
                    }
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Export & deletion") {
                Button {
                    Task { await requestExport() }
                } label: {
                    Label("Request data export", systemImage: "square.and.arrow.down")
                }
                .disabled(isLoading || status?.configured == false)

                if let export = objects.first(where: { $0.objectType == "export" && $0.status == "active" }) {
                    Button {
                        Task { await createDownloadURL(for: export.id) }
                    } label: {
                        Label("Create export download link", systemImage: "link")
                    }
                }

                Button(role: .destructive) {
                    Task { await requestDeletion() }
                } label: {
                    Label("Request data deletion", systemImage: "trash")
                }

                if let latestDownloadURL {
                    Text("Download link ready. It expires quickly and should be opened only from a trusted device.")
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                    Text(latestDownloadURL)
                        .font(.caption2)
                        .foregroundStyle(NearMindTheme.textSecondary)
                        .lineLimit(3)
                }

                if let message {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Storage")
        .navigationBarTitleDisplayMode(.inline)
        .task { await refresh() }
        .refreshable { await refresh() }
    }

    private func refresh() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let statusResponse = client.getStorageStatus()
            async let usageResponse = client.getStorageUsage()
            async let objectsResponse = client.getStorageObjects()
            status = try await statusResponse.decoded?.storage
            usage = try await usageResponse.decoded?.usage
            objects = try await objectsResponse.decoded?.objects ?? []
            message = nil
        } catch {
            message = error.localizedDescription
            appState.appendLocal(message: "Storage refresh failed: \(error.localizedDescription)")
        }
    }

    private func requestExport() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await client.requestStorageExport()
            message = "Export requested."
            if let object = response.decoded?.export {
                objects.insert(object, at: 0)
            }
        } catch {
            message = error.localizedDescription
        }
    }

    private func createDownloadURL(for objectId: String) async {
        do {
            latestDownloadURL = try await client.createStorageDownloadURL(id: objectId).decoded?.url
            message = "Signed download link created."
        } catch {
            message = error.localizedDescription
        }
    }

    private func requestDeletion() async {
        do {
            message = try await client.requestStorageDeletion(reason: "Requested from iOS Privacy & Storage").decoded?.deletionRequest.message
        } catch {
            message = error.localizedDescription
        }
    }

    private func usageRow(_ label: String, bytes: Double) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(NearMindTheme.textPrimary)
            Spacer()
            Text(formatBytes(bytes))
                .foregroundStyle(NearMindTheme.textSecondary)
        }
    }

    private var client: APIClient {
        APIClient(config: appState.environment.config, tokenStore: appState.environment.tokenStore)
    }
}

private func formatBytes(_ bytes: Double) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    return formatter.string(fromByteCount: Int64(bytes))
}

