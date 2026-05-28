# Mobile Readiness Checklist

Before starting native apps:

- Backend `/voice` and gateway `/gateway/voice` accept `protocolVersion: 1`.
- Unsupported protocol versions are rejected with `unsupported_protocol_version`.
- Mobile sync supports cursor polling and notification acknowledgement.
- Session state endpoint is read-only; no automatic audio resume.
- Profile mutation is explicit-only by default.
- Research subagent reports expose durable query/source/answer IDs.
- Governor budget endpoint enforces daily request limits.
- Daily tasks and commitments include `whySuggested`, source quote, confidence, and dedupe keys.
- Voice latency summary is available by session.
- Browser microphone validation is still a manual prerequisite and must not be claimed by automation.
