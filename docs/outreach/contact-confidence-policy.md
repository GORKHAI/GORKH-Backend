# Contact Confidence Policy

GORKH does not guess investor emails.

## Allowed

- Store an email only when it appears in a stored source snippet/title.
- Mark a generic contact page as `generic_contact`.
- Leave email `null` when no source-backed email exists.

## Disabled

- Pattern guessing like `first@firm.com`.
- Hunter/scraper-style inference.
- Purchased list ingestion.
- Sending emails.

If a guessed email is supplied by an internal process, it is rejected and recorded as `email_inference_not_allowed`.

