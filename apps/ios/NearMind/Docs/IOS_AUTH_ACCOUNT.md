# NearMind iOS Auth And Account

## Entry Flow

After onboarding, NearMind checks Keychain for a JWT.

- If no JWT exists, the app shows `AuthWelcomeView`.
- If a JWT exists, the app opens the main Chat/Live/Sessions/Profile tabs.

JWTs are stored only through `TokenStoreProtocol` and `KeychainTokenStore`. The app does not write JWTs to `UserDefaults`.

## Auth Welcome

The welcome screen includes:

- NearMind logo
- `NearMind`
- `Your private AI right hand for real-life moments.`
- Continue with Apple
- Continue with Email
- Small internal `Use test token` entry

The privacy note says microphone access starts only when the user starts Live Assist.

## Apple Sign In

The app uses `AuthenticationServices` and sends the Apple identity token to:

```text
POST /auth/apple/verify
```

The backend currently returns `apple_sign_in_not_enabled` unless Apple Sign In is configured. Raw Apple identity tokens are not logged.

## Email Sign In

Email sign-in calls:

```text
POST /auth/email/start
```

In v0 this returns a disabled/provider-not-configured error. No fake code is generated and no email is sent.

## Account And Plan

Profile includes Account and Plan sections.

Account:

- signed-in display name/email
- sign out
- account deletion request

Plan:

- `Internal Alpha`
- billing disabled
- subscriptions will be added later

There is no StoreKit, purchase button, price, paywall, or external payment link.

## Developer Token

Developer test-token paste remains under Profile > Developer and as a small link on the auth welcome screen. It is for internal alpha testing only and stores the token in Keychain.
## Storage Controls

Profile → Privacy & Data → Storage shows long-term storage usage, saved object counts, export request controls, and data deletion request routing.

The iOS app never receives or stores R2 credentials. It only calls authenticated backend APIs and receives owner-only signed download URLs when available.
