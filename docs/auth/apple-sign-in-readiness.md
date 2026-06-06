# Apple Sign In Readiness

NearMind iOS includes a native Sign in with Apple button. The backend endpoint is ready but disabled by default.

## Backend Endpoint

```text
POST /auth/apple/verify
```

Request:

```json
{
  "identityToken": "...",
  "authorizationCode": "... optional",
  "fullName": "... optional",
  "email": "... optional",
  "deviceLabel": "iPhone optional"
}
```

When `APPLE_SIGN_IN_ENABLED=false`, the endpoint returns `apple_sign_in_not_enabled`.

When enabled, the backend verifies the Apple identity token with Apple's public JWKS:

- issuer must be `https://appleid.apple.com`
- audience must match `APPLE_ALLOWED_AUDIENCES`
- subject becomes the auth provider subject

The backend then creates or finds the user, creates the Apple auth account row, creates the default plan, records an auth session, and returns a NearMind JWT. Raw Apple tokens are not logged or returned.

## iOS Notes

The app stores only the returned NearMind JWT in Keychain. It does not store Apple private keys, raw OAuth tokens, provider keys, or API secrets.
