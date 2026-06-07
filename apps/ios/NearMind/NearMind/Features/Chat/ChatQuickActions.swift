import SwiftUI

struct ChatQuickActions: View {
    let onSelect: (ChatQuickAction) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ChatQuickAction.allCases) { action in
                    Button {
                        onSelect(action)
                    } label: {
                        Text(action.rawValue)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textPrimary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(NearMindTheme.secondaryCTA, in: Capsule())
                            .overlay(Capsule().stroke(NearMindTheme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Adds this request to the chat")
                }
            }
            .padding(.horizontal, NearMindTheme.pagePadding)
        }
    }
}
