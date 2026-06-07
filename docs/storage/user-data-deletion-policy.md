# User Data Deletion Policy

Storage deletion in v0 is request-based. The app can request deletion, and the backend records an audit event.

The request does not silently destroy an account. Full account deletion remains handled by the account deletion workflow.

Object-level deletion is owner-only. It marks metadata as deleted and deletes the provider object when the configured provider matches the stored provider.

