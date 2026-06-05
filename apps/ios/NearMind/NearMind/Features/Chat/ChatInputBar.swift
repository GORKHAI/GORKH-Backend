import SwiftUI

struct ChatInputBar: View {
    @Binding var text: String
    let isLoading: Bool
    let onSend: () -> Void
    let onMic: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onMic) {
                Image(systemName: "mic")
                    .font(.body.weight(.semibold))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .foregroundStyle(NearMindTheme.accentMint)
            .accessibilityLabel("Voice")

            TextField("Message NearMind…", text: $text, axis: .vertical)
                .lineLimit(1...4)
                .textInputAutocapitalization(.sentences)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(NearMindTheme.elevatedSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .foregroundStyle(NearMindTheme.textPrimary)

            Button(action: onSend) {
                Image(systemName: isLoading ? "ellipsis" : "arrow.up")
                    .font(.body.weight(.bold))
                    .frame(width: 38, height: 38)
                    .background(NearMindTheme.accentMint, in: Circle())
                    .foregroundStyle(NearMindTheme.background)
            }
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
            .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.55 : 1)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }
}
