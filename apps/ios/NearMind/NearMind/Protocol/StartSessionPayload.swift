import Foundation

struct StartSessionPayload: Codable, Equatable {
    struct Consent: Codable, Equatable {
        let granted: Bool
        let method: String
        let noticeText: String
        let participantCount: Int
        let jurisdiction: String
    }

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
    let consent: Consent
    let input: Input
    let output: Output
    let retentionPolicy: RetentionPolicy

    init(
        policy: AssistPolicy,
        situationDescription: String,
        title: String,
        consentGranted: Bool
    ) {
        self.type = .start
        self.protocolVersion = MobileProtocol.protocolVersion
        self.policy = policy
        self.situationDescription = situationDescription
        self.title = title
        self.consent = Consent(
            granted: consentGranted,
            method: "user_tap",
            noticeText: "Live Assist is active. I confirm I have the right consent for this conversation.",
            participantCount: policy == .whisperCopilot ? 2 : 1,
            jurisdiction: "unknown"
        )
        self.input = Input(kind: .text)
        self.output = Output(kind: .both)
        self.retentionPolicy = .askOnStop
    }
}
