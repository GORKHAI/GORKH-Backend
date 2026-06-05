import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()

            VStack(alignment: .leading, spacing: 10) {
                Text("NearMind")
                    .font(.largeTitle.weight(.bold))
                Text("A consent-first iOS client for the GORKH Brain backend.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                SectionCard(title: "Explicit sessions") {
                    Text("Live Assist starts only when you connect and start a session.")
                        .foregroundStyle(.secondary)
                }

                SectionCard(title: "No hidden recording") {
                    Text("This v0 scaffold does not start the microphone, stream audio, or record in the background.")
                        .foregroundStyle(.secondary)
                }

                SectionCard(title: "Typed prototype") {
                    Text("You can send typed user text and typed transcripts over the gateway for protocol validation.")
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            PrimaryButton("Continue", systemImage: "checkmark.circle") {
                appState.completeOnboarding()
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
    }
}
