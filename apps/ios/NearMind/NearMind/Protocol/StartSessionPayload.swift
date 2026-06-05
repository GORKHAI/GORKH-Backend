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
        let sampleRate: Int?
        let channels: Int?

        init(kind: TextInputKind, sampleRate: Int? = nil, channels: Int? = nil) {
            self.kind = kind
            self.sampleRate = sampleRate
            self.channels = channels
        }
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
        consentGranted: Bool,
        input: Input = Input(kind: .text),
        retentionPolicy: RetentionPolicy = .askOnStop
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
        self.input = input
        self.output = Output(kind: .both)
        self.retentionPolicy = retentionPolicy
    }

    static func pcm16Voice(
        policy: AssistPolicy,
        situationDescription: String,
        title: String,
        consentGranted: Bool,
        retentionPolicy: RetentionPolicy = .askOnStop
    ) -> StartSessionPayload {
        StartSessionPayload(
            policy: policy,
            situationDescription: situationDescription,
            title: title,
            consentGranted: consentGranted,
            input: Input(kind: .pcm16, sampleRate: 16_000, channels: 1),
            retentionPolicy: retentionPolicy
        )
    }
}
