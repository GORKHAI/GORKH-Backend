import SwiftUI

struct AuthWelcomeView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel: AuthViewModel

    init(appState: AppState) {
        _viewModel = StateObject(wrappedValue: AuthViewModel(appState: appState))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NearMindTheme.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        Spacer(minLength: 18)

                        Image("NearMindLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 76, height: 76)
                            .accessibilityHidden(true)

                        VStack(spacing: 10) {
                            Text("NearMind")
                                .font(.largeTitle.weight(.semibold))
                                .foregroundStyle(NearMindTheme.textPrimary)
                            Text("Your private AI right hand for real-life moments.")
                                .font(.title3)
                                .multilineTextAlignment(.center)
                                .foregroundStyle(NearMindTheme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        VStack(spacing: 14) {
                            AppleSignInButtonView { identityToken, authorizationCode, fullName, email in
                                viewModel.signInWithApple(identityToken: identityToken, authorizationCode: authorizationCode, fullName: fullName, email: email)
                            } onError: { message in
                                appState.appendLocal(message: "Apple sign-in failed: \(message)")
                            }

                            Button {
                                withAnimation(.snappy) {
                                    viewModel.mode = .email
                                }
                            } label: {
                                Label("Continue with Email", systemImage: "envelope")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 54)
                                    .foregroundStyle(NearMindTheme.accentMint)
                                    .background(NearMindTheme.secondaryCTA)
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                        }

                        if viewModel.mode == .email {
                            EmailSignInView(viewModel: viewModel)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        Text("NearMind is consent-first. Microphone access starts only when you start Live Assist.")
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(NearMindTheme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)

                        if let status = viewModel.statusMessage {
                            Text(status)
                                .font(.footnote.weight(.medium))
                                .multilineTextAlignment(.center)
                                .foregroundStyle(NearMindTheme.warning)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Button("Use test token") {
                            withAnimation(.snappy) {
                                viewModel.mode = viewModel.mode == .developerToken ? .welcome : .developerToken
                            }
                        }
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(NearMindTheme.textSecondary)

                        if viewModel.mode == .developerToken {
                            VStack(spacing: 12) {
                                SecureField("Paste test JWT", text: $viewModel.developerToken)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(14)
                                    .background(NearMindTheme.cardSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                Text("Developer token is for internal alpha testing. It is stored in Keychain only.")
                                    .font(.caption)
                                    .foregroundStyle(NearMindTheme.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                PrimaryButton("Save test token", systemImage: "key") {
                                    viewModel.saveDeveloperToken()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 28)
                    .frame(maxWidth: 560)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
            }
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}
