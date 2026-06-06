# Plan Shell v0

NearMind v0 has a status-only plan shell. Billing is not enabled.

## Endpoint

```text
GET /plans/me
```

Default response:

```json
{
  "plan": {
    "planCode": "internal_alpha",
    "status": "billing_not_enabled",
    "billingEnabled": false,
    "source": "system",
    "currentPeriodEnd": null,
    "displayName": "Internal Alpha",
    "message": "Billing is not enabled in this alpha."
  }
}
```

Billing readiness endpoint:

```text
GET /billing/status
```

Response:

```json
{
  "billingEnabled": false,
  "provider": "none",
  "message": "Billing is not enabled in this alpha."
}
```

## Product Rules

- No StoreKit implementation in this milestone.
- No purchase button.
- No fake pricing.
- No fake paywall.
- No external payment link.
