import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: AppTab = .chat

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                ChatView(
                    openLive: { selectedTab = .live },
                    openProfile: { selectedTab = .profile }
                )
            }
            .tabItem {
                Label(AppTab.chat.title, systemImage: AppTab.chat.systemImage)
            }
            .tag(AppTab.chat)

            NavigationStack {
                LiveAssistView()
            }
            .tabItem {
                Label(AppTab.live.title, systemImage: AppTab.live.systemImage)
            }
            .tag(AppTab.live)

            NavigationStack {
                SessionsView {
                    selectedTab = .live
                }
            }
            .tabItem {
                Label(AppTab.sessions.title, systemImage: AppTab.sessions.systemImage)
            }
            .tag(AppTab.sessions)

            NavigationStack {
                YouView()
            }
            .tabItem {
                Label(AppTab.profile.title, systemImage: AppTab.profile.systemImage)
            }
            .tag(AppTab.profile)
        }
        .tint(NearMindTheme.accentMint)
    }
}
