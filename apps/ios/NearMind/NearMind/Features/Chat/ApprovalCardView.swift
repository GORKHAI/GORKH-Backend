import SwiftUI

struct ApprovalCardView: View {
    let approval: ChatApproval
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(approval.title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Spacer()
                if let riskLevel = approval.riskLevel {
                    MiniStatusBadge(
                        text: riskLevel.rawValue,
                        color: riskLevel == .sensitive ? NearMindTheme.warning : NearMindTheme.success
                    )
                }
            }

            Text(approval.explanation)
                .font(.subheadline)
                .foregroundStyle(NearMindTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                Button(approval.cancelLabel, action: onCancel)
                    .buttonStyle(.bordered)
                    .tint(NearMindTheme.textSecondary)

                Button(approval.confirmLabel, action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .tint(NearMindTheme.primaryCTA)
            }
        }
        .padding(16)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: NearMindTheme.radius).stroke(NearMindTheme.border, lineWidth: 1))
    }
}
