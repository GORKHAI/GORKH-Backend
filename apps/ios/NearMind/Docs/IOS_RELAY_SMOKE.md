# iOS Relay Manual Smoke

## Setup

1. Install NearMind on an iPhone or simulator.
2. Paste a JWT for User A.
3. Optionally use a second device or simulator for User B.
4. If only one device is available, test User B through the backend or Brain Console with a separate User B JWT.
5. Confirm no `.env`, JWT, token, or provider secret is committed.

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
