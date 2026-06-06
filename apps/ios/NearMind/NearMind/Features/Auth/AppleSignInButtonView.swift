import AuthenticationServices
import SwiftUI

struct AppleSignInButtonView: View {
    let onCredential: (_ identityToken: String, _ authorizationCode: String?, _ fullName: String?, _ email: String?) -> Void
    let onError: (String) -> Void

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let identityData = credential.identityToken,
                      let identityToken = String(data: identityData, encoding: .utf8) else {
                    onError("Apple did not return an identity token.")
                    return
                }
                let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
                let fullName = credential.fullName.map { PersonNameComponentsFormatter().string(from: $0) } ?? ""
                onCredential(identityToken, authorizationCode, fullName.isEmpty ? nil : fullName, credential.email)
            case .failure(let error):
                onError(error.localizedDescription)
            }
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
