import SwiftUI

struct DebugEventLogView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            if appState.eventLog.isEmpty {
                Text("No decoded gateway events yet.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(appState.eventLog) { event in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(event.title)
                                .font(.headline)
                            Spacer()
                            Text(event.timestamp, style: .time)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let rawJSON = event.rawJSON {
                            Text(rawJSON)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.black.ignoresSafeArea())
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
