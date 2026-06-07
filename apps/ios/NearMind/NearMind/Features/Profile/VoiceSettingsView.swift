import SwiftUI

struct VoiceSettingsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section("Voice Output") {
                Picker("Voice Output", selection: Binding(
                    get: { appState.voiceOutputMode },
                    set: { appState.setVoiceOutputMode($0) }
                )) {
                    ForEach(VoiceOutputMode.allCases) { mode in
                        Text(mode.displayTitle).tag(mode)
                    }
                }

                Text("Natural Voice uses a cloud voice provider to make NearMind sound more human. Only assistant response text is sent, not your microphone audio.")
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Voice Character") {
                Picker("Voice Character", selection: Binding(
                    get: { appState.naturalVoiceCharacter },
                    set: { appState.setNaturalVoiceCharacter($0) }
                )) {
                    ForEach(NaturalVoiceCharacterID.allCases) { character in
                        Text(character.displayName).tag(character)
                    }
                }

                ForEach(NaturalVoiceCharacterID.allCases) { character in
                    ProfileRow(
                        title: character.displayName,
                        subtitle: character.subtitle,
                        systemImage: appState.naturalVoiceCharacter == character ? "checkmark.circle.fill" : "waveform"
                    )
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Fallback") {
                Toggle(isOn: Binding(
                    get: { appState.naturalVoiceFallbackEnabled },
                    set: { appState.setNaturalVoiceFallbackEnabled($0) }
                )) {
                    ProfileRow(
                        title: "Use native fallback",
                        subtitle: "If Natural Voice fails, use local iOS speech.",
                        systemImage: "arrow.triangle.2.circlepath"
                    )
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Safety") {
                ProfileRow(title: "No voice cloning", subtitle: "NearMind does not clone or imitate real people.", systemImage: "person.crop.circle.badge.xmark")
                ProfileRow(title: "No provider keys in app", subtitle: "Natural Voice requests go through the Voice Gateway.", systemImage: "lock.shield")
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Voice Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
