# iOS Relay Manual Smoke

## Setup

1. Install NearMind on an iPhone or simulator.
2. Confirm backend live verification has passed with `npm run relay:live:verify`.
3. Paste a JWT for User A.
4. Optionally use a second device or simulator for User B.
5. If only one device is available, test User B through the backend or Brain Console with a separate User B JWT.
6. Confirm no `.env`, JWT, token, or provider secret is committed.

For Render live testing, use:

- API: `https://api.gorkh.com`
- Gateway: `https://voice.gorkh.com`

Do not use Render internal service addresses from iOS or local scripts.

## User A Flow

1. Open Profile -> Agent Requests.
2. Create or verify Relay Identity.
3. Add a trusted contact for User B.
4. Draft request:
   “Ask Steve if he is available for an investor call next week.”
5. Confirm Send Request.
6. Verify the request appears in Outbox.
7. Verify no email was sent.

## User B Flow

1. Login or paste User B JWT.
2. Open Profile -> Agent Requests -> Inbox.
3. Open the request.
4. Approve, Reject, Ignore, or Block.
5. Verify User A sees mobile sync/request updates.
6. Verify audit events in Brain Console or backend if visible.

## One-Device Alternative

1. Complete the User A flow in the app.
2. Use a simulator, second installed app, backend script, or Brain Console with User B credentials to approve/reject/ignore/block.
3. Return to User A in the app.
4. Fetch mobile sync or refresh Agent Requests.
5. Confirm the request status updated.

## Privacy Checks

- No private memory is shared automatically.
- No calendar or email data is shared automatically.
- No raw `userId` is sent by the app.
- No external email is sent.
- No external action is executed.
- Block prevents future requests from the blocked sender.
- JWTs and raw tokens do not appear in app logs, backend logs, or debug event logs.

## Expected Result

Relay is ready for controlled two-user testing when:

- User A can draft and approve send.
- User B can see the inbox request.
- User B can approve, reject, ignore, or block.
- Mobile sync emits Relay items.
- Audit events exist.
- No external send/action or automatic private data sharing occurs.

## Backend-Gated Readiness

Before calling the iOS Relay smoke production-ready, the backend live verifier should show:

- API health and ready passed.
- Gateway health and providers passed.
- User A and User B identities created or loaded.
- User A created a trusted contact and approved send.
- User B received the request through inbox/mobile sync.
- User B approve/reject/ignore/block paths passed.
- Block prevented a follow-up request.
- Audit events existed.
- `externalSendExecuted=false`.
- `privacyLeakDetected=false`.
- `rawTokenPrinted=false`.
