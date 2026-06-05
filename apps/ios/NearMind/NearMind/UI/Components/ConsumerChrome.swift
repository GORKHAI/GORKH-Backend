import SwiftUI

struct AppHeader: View {
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            NearMindLogoMark(size: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.top, 4)
    }
}

struct EmptyStateView: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(NearMindTheme.accentMint)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            Text(message)
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(NearMindTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius))
    }
}

struct MiniStatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(NearMindTheme.badgeBackground, in: Capsule())
            .overlay(Capsule().stroke(color.opacity(0.22), lineWidth: 1))
    }
}

struct NativeCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius))
    }
}

struct ConsumerSectionHeader: View {
    let title: String
    let actionTitle: String?
    let action: (() -> Void)?

    init(_ title: String, actionTitle: String? = nil, action: (() -> Void)? = nil) {
        self.title = title
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(NearMindTheme.accentMint)
            }
        }
        .padding(.horizontal, 2)
    }
}
