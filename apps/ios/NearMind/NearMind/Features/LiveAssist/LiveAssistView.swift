import SwiftUI

struct LiveAssistView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = LiveAssistViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SectionCard(title: "Gateway", subtitle: appState.environment.config.gatewayWebSocketURL.absoluteString) {
                    HStack {
                        StatusPill(
                            text: viewModel.isConnected ? "Connected" : "Disconnected",
                            color: viewModel.isConnected ? .green : .orange
                        )
                        Text(viewModel.status)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                SectionCard(title: "Session") {
                    Picker("Policy", selection: $viewModel.policy) {
                        ForEach(AssistPolicy.allCases) { policy in
                            Text(policy.rawValue).tag(policy)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Title", text: $viewModel.title)
                        .textFieldStyle(.roundedBorder)

                    TextField("Situation description", text: $viewModel.situationDescription, axis: .vertical)
                        .lineLimit(3...5)
                        .textFieldStyle(.roundedBorder)

                    Toggle("I consent to start this typed Live Assist session", isOn: $viewModel.hasConsent)
                        .toggleStyle(.switch)

                    PrimaryButton("Start Text Session", systemImage: "play.circle", isDisabled: !viewModel.hasConsent) {
                        viewModel.startTextSession()
                    }
                }

                SectionCard(title: "Typed Input") {
                    TextField("Typed user text", text: $viewModel.typedUserText, axis: .vertical)
                        .lineLimit(2...5)
                        .textFieldStyle(.roundedBorder)
                    PrimaryButton("Send Typed User Text", systemImage: "paperplane") {
                        viewModel.sendTypedUserText()
                    }

                    Divider()
                        .background(Color.white.opacity(0.2))

                    TextField("Typed transcript", text: $viewModel.typedTranscript, axis: .vertical)
                        .lineLimit(2...5)
                        .textFieldStyle(.roundedBorder)
                    PrimaryButton("Send Typed Transcript", systemImage: "text.bubble") {
                        viewModel.sendTypedTranscript()
                    }
                }

                SectionCard(title: "Connection Controls") {
                    HStack {
                        Button {
                            viewModel.connect()
                        } label: {
                            Label("Connect", systemImage: "bolt.horizontal.circle")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)

                        Button(role: .destructive) {
                            viewModel.disconnect()
                        } label: {
                            Label("Disconnect", systemImage: "xmark.circle")
                        }
                        .buttonStyle(.bordered)
                    }

                    Button(role: .destructive) {
                        viewModel.stopWithoutSaving()
                    } label: {
                        Label("Stop save=false", systemImage: "stop.circle")
                    }
                    .buttonStyle(.bordered)
                }

                SectionCard(title: "Event Log") {
                    if appState.eventLog.isEmpty {
                        Text("No events yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(appState.eventLog.prefix(8)) { event in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(event.title)
                                    .font(.subheadline.weight(.semibold))
                                if let rawJSON = event.rawJSON {
                                    Text(rawJSON)
                                        .font(.caption.monospaced())
                                        .foregroundStyle(.secondary)
                                        .lineLimit(3)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.black.ignoresSafeArea())
        .navigationTitle("Live Assist")
        .onAppear {
            viewModel.configure(environment: appState.environment, appState: appState)
        }
    }
}
