import SwiftUI

struct ChatMessageBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 44)
            }

            Text(message.text)
                .font(.body)
                .foregroundStyle(NearMindTheme.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 15)
                .padding(.vertical, 11)
                .background(background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(border, lineWidth: 1)
                )

            if message.role != .user {
                Spacer(minLength: 44)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var background: Color {
        switch message.role {
        case .assistant:
            return NearMindTheme.cardSurface
        case .user:
            return NearMindTheme.primaryCTA
        case .system:
            return NearMindTheme.elevatedSurface
        }
    }

    private var border: Color {
        message.role == .user ? NearMindTheme.accentMint.opacity(0.24) : NearMindTheme.border
    }
}
