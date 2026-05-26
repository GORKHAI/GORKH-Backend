# Human Model Policy

The human model is an inspectable user profile, not a hidden psychological model.

Allowed low-risk facts:

- Occupation or domain when stated by the user.
- Active projects.
- Goals.
- Communication preferences.
- Important people or organizations when useful for situational support.
- Repeated workflows.

Sensitive facts:

- Stress patterns.
- Psychological or emotional patterns.
- Health details.
- Relationship details.
- Legal/financial distress details.

Rules:

- Explicit low-risk facts may be confirmed when configured.
- Inferred facts are proposed, not confirmed.
- Sensitive facts are never auto-confirmed.
- Stress or psychological storage requires opt-in and confirmation.
- The user can inspect, confirm, or reject facts.
- No diagnosis, lie detection, emotion certainty, or manipulation advice.

`GET /human/profile/review` returns confirmed facts, proposed facts, sensitive candidates, rejected facts, a confirmed-only summary, and pending actions.

Brain Console uses this review API as the local control surface. It can confirm or reject facts, but it must never auto-confirm sensitive candidates.
