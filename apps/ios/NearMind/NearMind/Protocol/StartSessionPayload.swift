import Foundation

struct StartSessionPayload: Codable, Equatable {
    struct Input: Codable, Equatable {
        let kind: TextInputKind
    }

    struct Output: Codable, Equatable {
        let kind: OutputKind
    }

    let type: ClientEventType
    let protocolVersion: Int
    let policy: AssistPolicy
    let situationDescription: String
    let title: String
    let consent: Bool
    let input: Input
    let output: Output
    let retentionPolicy: RetentionPolicy

    init(
        policy: AssistPolicy,
        situationDescription: String,
        title: String,
        consent: Bool
    ) {
        self.type = .start
        self.protocolVersion = MobileProtocol.protocolVersion
        self.policy = policy
        self.situationDescription = situationDescription
        self.title = title
        self.consent = consent
        self.input = Input(kind: .text)
        self.output = Output(kind: .both)
        self.retentionPolicy = .askOnStop
    }
}
