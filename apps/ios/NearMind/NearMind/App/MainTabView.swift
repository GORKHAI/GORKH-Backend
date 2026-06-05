import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: AppTab = .today

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                TodayView {
                    selectedTab = .assist
                }
            }
            .tabItem {
                Label(AppTab.today.title, systemImage: AppTab.today.systemImage)
            }
            .tag(AppTab.today)

            NavigationStack {
                LiveAssistView()
            }
            .tabItem {
                Label(AppTab.assist.title, systemImage: AppTab.assist.systemImage)
            }
            .tag(AppTab.assist)

            NavigationStack {
                SessionsView()
            }
            .tabItem {
                Label(AppTab.sessions.title, systemImage: AppTab.sessions.systemImage)
            }
            .tag(AppTab.sessions)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label(AppTab.settings.title, systemImage: AppTab.settings.systemImage)
            }
            .tag(AppTab.settings)
        }
        .tint(NearMindTheme.accentMint)
    }
}
