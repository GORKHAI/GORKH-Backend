import SwiftUI

struct EmailSignInView: View {
    @ObservedObject var viewModel: AuthViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Continue with Email")
                .font(.title3.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            Text("Email sign-in is wired for readiness. It stays disabled until a real provider is configured.")
                .font(.subheadline)
                .foregroundStyle(NearMindTheme.textSecondary)
            TextField("Email", text: $viewModel.email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(14)
                .background(NearMindTheme.cardSurface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            PrimaryButton("Continue", systemImage: "envelope") {
                viewModel.startEmailSignIn()
            }
            .disabled(viewModel.isWorking)
        }
    }
}
