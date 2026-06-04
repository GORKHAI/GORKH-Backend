# Room Consent Policy

Nearmind Rooms are consent-first.

- No hidden recording.
- No transcript before consent.
- Guest invite flow shows consent state before token fetch.
- Guest LiveKit token issuance is blocked while consent is pending or denied.
- Host transcript ingestion checks consent for all human participants.
- Denied consent blocks transcript ingestion.
- AI does not speak to guests by default.
- Recording remains disabled in v0/v1.

Audit events record safe metadata such as room creation, guest link creation, consent decision, transcript segment creation, and summary generation. Secrets and raw invite token hashes are not exposed in API responses.
