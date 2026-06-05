import SwiftUI

struct RelayOutboxView: View {
    let requests: [RelayRequestSummary]

    var body: some View {
        if requests.isEmpty {
            NativeEmptyRow(title: "No outbox requests", subtitle: "Requests you approve to send will be tracked here.")
        } else {
            ForEach(requests) { request in
                VStack(alignment: .leading, spacing: 4) {
                    Text(request.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NearMindTheme.textPrimary)
                    Text(request.summary)
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }
        }
    }
}
