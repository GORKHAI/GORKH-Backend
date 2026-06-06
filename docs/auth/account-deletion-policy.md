# Account Deletion Policy v0

NearMind v0 supports deletion requests, not immediate self-service deletion.

## Endpoint

```text
POST /account/delete-request
```

Request:

```json
{ "reason": "optional" }
```

Response message:

```text
Your account deletion request has been recorded.
```

The backend records `account_deletion_requests.status = requested` and creates an account audit event. No immediate data erasure runs in v0.

Users can cancel a pending request:

```text
POST /account/delete-cancel
```

## App UX

The iOS Profile tab exposes Account deletion under Privacy & Data and the Account screen. The copy makes clear that deletion is serious and that alpha behavior records a backend request.
