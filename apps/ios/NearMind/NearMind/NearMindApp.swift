import SwiftUI

@main
struct NearMindApp: App {
    @StateObject private var appState = AppState(environment: .live)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
        }
    }
}

private struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            if !appState.hasCompletedOnboarding {
                OnboardingView()
            } else if appState.isAuthenticated {
                MainTabView()
            } else {
                AuthWelcomeView(appState: appState)
            }
        }
        .preferredColorScheme(.dark)
        .task {
            appState.refreshAuthStatus()
            await appState.refreshAccount()
        }
    }
}
