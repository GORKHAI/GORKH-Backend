# GORKH Brain Hardening Plan

## Completed In This Pass

- Verified local reference archives were present and inspected statically.
- Added `.reference-agent-labs/` to gitignore for extracted reference code.
- Added profile review, reflection review, dashboard, audit-event, stress-settings, research-provider, tool-permissions, and skill-match APIs.
- Hardened interrupted-session handling so session-sourced profile facts and reflections are removed even when transcript retention is temporarily kept.
- Added skill manifest validation against dangerous workflow steps.
- Added minimal `skill_versions` audit rows.
- Added audit events for core Adaptive Brain observations.
- Added brain replays for inventory, implementation audit, review/control surfaces, skill matching, reflection review, provider status, dashboard, and voice profile adaptation.
- Added Brain Console v0 as a local browser control surface for profile review, stress settings, skills, reflections, research status/querying, tool permissions, audit events, and session privacy counts.
- Added provider-live research check/replay commands that validate real source-backed results when provider keys exist and clearly skip without fake output when none are configured.

## Remaining Hardening

1. Add richer reflection scoring from explicit feedback and outcomes.
2. Add full skill diff/version review APIs before allowing user-authored skills.
3. Add profile fact expiration/revalidation for inferred facts.
4. Add a production UI for the Brain Console workflows in the mobile client.
5. Add structured audit redaction policies for payloads before mobile dashboard display.
6. Add explicit user approval workflow for any future external action tool.

## Permanent Boundaries

- No fine-tuning in Adaptive Brain v0.
- No hidden recording.
- No storage of sensitive stress or psychological facts without explicit opt-in and confirmation.
- No diagnosis, treatment recommendation, therapy claim, lie detection, emotion-certainty claim, or manipulation advice.
- No autonomous financial, legal, medical, payment, browser-login, form, shell, or messaging action.
