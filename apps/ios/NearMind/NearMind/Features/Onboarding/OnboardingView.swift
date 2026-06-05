import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()

            VStack(alignment: .leading, spacing: 14) {
                NearMindLogoMark(size: 96)
                Text("NearMind")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text("Your private AI right hand for real-life moments.")
                    .font(.title3)
                    .foregroundStyle(NearMindTheme.textSecondary)
            }

            VStack(spacing: 12) {
                SectionCard(title: "Consent-first") {
                    Text("Live Assist starts only after you confirm consent and tap Start.")
                        .foregroundStyle(NearMindTheme.textSecondary)
                }

                SectionCard(title: "No hidden recording") {
                    Text("The microphone is off by default and never runs as background always-listening.")
                        .foregroundStyle(NearMindTheme.textSecondary)
                }

                SectionCard(title: "Stop or discard") {
                    Text("Microphone sessions can stop with save=false to discard the live session.")
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }

            Spacer()

            PrimaryButton("Continue", systemImage: "checkmark.circle") {
                appState.completeOnboarding()
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(NearMindTheme.background.ignoresSafeArea())
    }
}
