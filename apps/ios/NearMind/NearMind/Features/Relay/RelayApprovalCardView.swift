import SwiftUI

struct RelayApprovalCardView: View {
    let title: String
    let summary: String
    let riskLevel: String?
    let confirmLabel: String
    let cancelLabel: String
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Human approval required", systemImage: "checkmark.shield")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NearMindTheme.accentMint)
                Spacer()
                if let riskLevel {
                    MiniStatusBadge(text: riskLevel.capitalized, color: badgeColor)
                }
            }

            Text(title)
                .font(.headline)
                .foregroundStyle(NearMindTheme.textPrimary)

            Text(summary)
                .font(.subheadline)
                .foregroundStyle(NearMindTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 10) {
                Button(cancelLabel, action: onCancel)
                    .buttonStyle(.bordered)
                Button(confirmLabel, action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .tint(NearMindTheme.primaryCTA)
            }
        }
        .padding(14)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius))
        .overlay {
            RoundedRectangle(cornerRadius: NearMindTheme.radius)
                .stroke(NearMindTheme.border)
        }
    }

    private var badgeColor: Color {
        switch riskLevel {
        case "high":
            return NearMindTheme.error
        case "low":
            return NearMindTheme.success
        default:
            return NearMindTheme.warning
        }
    }
}
