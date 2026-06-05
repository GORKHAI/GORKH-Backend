import SwiftUI

struct DebugEventLogView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            if appState.eventLog.isEmpty {
                Text("No decoded gateway events yet.")
                    .foregroundStyle(NearMindTheme.textSecondary)
            } else {
                ForEach(appState.eventLog) { event in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(event.title)
                                .font(.headline)
                            Spacer()
                            Text(event.timestamp, style: .time)
                                .font(.caption)
                                .foregroundStyle(NearMindTheme.textSecondary)
                        }
                        if let rawJSON = event.rawJSON {
                            Text(rawJSON)
                                .font(.caption.monospaced())
                                .foregroundStyle(NearMindTheme.textSecondary)
                                .textSelection(.enabled)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Debug Log")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    appState.clearEvents()
                } label: {
                    Label("Clear", systemImage: "trash")
                }
            }
        }
    }
}
