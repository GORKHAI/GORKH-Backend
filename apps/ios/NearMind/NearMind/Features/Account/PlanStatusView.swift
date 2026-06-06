import SwiftUI

struct PlanStatusView: View {
    let plan: PlanStatus?
    let billing: BillingStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(plan?.displayName ?? "Internal Alpha")
                .font(.headline)
                .foregroundStyle(NearMindTheme.textPrimary)
            Text(billing?.message ?? plan?.message ?? "Billing is not enabled.")
                .font(.subheadline)
                .foregroundStyle(NearMindTheme.textSecondary)
            Text("Subscriptions will be added later.")
                .font(.caption)
                .foregroundStyle(NearMindTheme.textSecondary)
        }
        .padding()
        .background(NearMindTheme.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
