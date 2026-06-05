import Foundation

protocol TokenStoreProtocol: AnyObject {
    func saveToken(_ token: String) throws
    func readToken() throws -> String?
    func clearToken() throws
}

final class KeychainTokenStore: TokenStoreProtocol {
    private let keychain: KeychainStore
    private let account = "user-jwt"

    init(keychain: KeychainStore) {
        self.keychain = keychain
    }

    func saveToken(_ token: String) throws {
        try keychain.save(token, account: account)
    }

    func readToken() throws -> String? {
        try keychain.read(account: account)
    }

    func clearToken() throws {
        try keychain.delete(account: account)
    }
}
