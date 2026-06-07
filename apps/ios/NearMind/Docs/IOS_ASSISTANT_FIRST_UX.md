# NearMind iOS Assistant-First UX v0.6

NearMind should feel like a private assistant the user talks to, not a module dashboard.

## Navigation

- Chat is the app home and relationship surface.
- Live is the explicit consent-based voice mode.
- Sessions is the memory timeline for saved Live Assist sessions.
- You is the personal hub for account, memory, privacy, requests, preferences, audio, and internal tools.

## Chat

Chat starts with:

```text
Tell me what’s happening, or ask what needs attention.
```

Quick actions are conversational:

- What should I do today?
- Prepare me
- Start Live
- What did I promise?
- Show my memory
- Ask someone

Chat can propose local settings changes or navigation, but sensitive actions require approval cards. It does not start the microphone, delete memory, send external requests, or execute autonomous actions.

## Live

Live remains the only streaming microphone mode. The inactive state keeps context, consent, and Start Live Assist primary. Policy/title live under More options. Active state prioritizes listening status, current cue/guidance, transcript preview, Stop & Discard, Save, Mute, and Barge in.

## You

You replaces Profile. The top level is intentionally simple:

- Account
- Memory
- Privacy
- Requests
- Preferences
- Audio
- Developer

Developer tools, diagnostics, token paste, typed smoke tests, debug logs, and protocol details are lower-priority internal tools under You > Developer.

## Human Control

Permanent product rule:

```text
The agent helps. The human decides.
```

Sensitive actions, memory/profile changes, data deletion, relay/request sends, external actions, and privacy changes must be approval-gated. No hidden recording and no background always-listening are allowed.
