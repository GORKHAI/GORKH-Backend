import Foundation

struct AppEnvironment {
    let config: AppConfig
    let tokenStore: TokenStoreProtocol
    let apiClient: APIClient

    static let live: AppEnvironment = {
        let config = AppConfig.production
        let keychain = KeychainStore(service: "ai.nearmind.app.auth")
        let tokenStore = KeychainTokenStore(keychain: keychain)
        return AppEnvironment(
            config: config,
            tokenStore: tokenStore,
            apiClient: APIClient(config: config, tokenStore: tokenStore)
        )
    }()
}
