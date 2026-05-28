# Google OAuth Setup

1. Create a Google Cloud OAuth client for a web application.
2. Add the callback URL:

```text
https://api.gorkh.com/connectors/oauth/google-calendar/callback
```

3. Configure Render API service env:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CALENDAR_READONLY_ENABLED=true
GOOGLE_CLIENT_ID=<Google OAuth client id>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_OAUTH_REDIRECT_URI=https://api.gorkh.com/connectors/oauth/google-calendar/callback
TOKEN_VAULT_PROVIDER=encrypted_db
TOKEN_VAULT_ENCRYPTION_KEY=<32-byte base64 or 64-char hex key>
TOKEN_VAULT_KEY_ID=render-v1
```

4. Open Brain Console, use Google Calendar Connect, complete OAuth, then run Sync Preview.

Only `calendar.events.readonly` is requested in v0. Write scopes are rejected.
