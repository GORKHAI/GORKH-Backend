import SwiftUI

struct OnboardingPage: Identifiable, Equatable {
    let id: Int
    let title: String
    let message: String

    static let defaults: [OnboardingPage] = [
        OnboardingPage(
            id: 0,
            title: "NearMind",
            message: "Your private AI right hand for real-life moments."
        ),
        OnboardingPage(
            id: 1,
            title: "Consent-first",
            message: "Live Assist starts only when you choose. No hidden recording."
        ),
        OnboardingPage(
            id: 2,
            title: "Control",
            message: "Stop, save, or discard sessions. Tokens stay in Keychain."
        )
    ]
}

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selection = 0

    private let pages = OnboardingPage.defaults

    var body: some View {
        VStack(spacing: 24) {
            Spacer(minLength: 28)

            NearMindLogoMark(size: 54)

            TabView(selection: $selection) {
                ForEach(pages) { page in
                    OnboardingPageView(page: page)
                        .tag(page.id)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .frame(minHeight: 300)

            PrimaryButton(selection == pages.count - 1 ? "Get Started" : "Continue", systemImage: "arrow.right") {
                if selection < pages.count - 1 {
                    withAnimation(.easeInOut) {
                        selection += 1
                    }
                } else {
                    appState.completeOnboarding()
                }
            }
            .padding(.horizontal, NearMindTheme.pagePadding)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(NearMindTheme.background.ignoresSafeArea())
    }
}

private struct OnboardingPageView: View {
    let page: OnboardingPage

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 10) {
                Text(page.title)
                    .font(.largeTitle.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                    .multilineTextAlignment(.center)
                Text(page.message)
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
