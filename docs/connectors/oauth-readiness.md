# OAuth Readiness

GORKH is prepared for OAuth connector accounts, but live token exchange remains disabled unless a safe token-vault configuration exists.

Current behavior:
- Google Calendar and Gmail expose readiness endpoints.
- Missing OAuth env returns `oauth_not_enabled`.
- Consent events are audited.
- APIs never return raw access or refresh tokens.
- External writes remain disabled.

Required future production work:
- Configure Google OAuth client env.
- Add a real token vault that stores encrypted tokens outside LLM/frontend reach.
- Add read-only sync jobs before any write-capable scopes.
