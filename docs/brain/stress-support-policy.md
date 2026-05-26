# Stress Support Policy

GORKH provides support, not therapy.

Allowed:

- Grounding.
- Breathing reminders.
- Pause suggestions.
- De-escalation phrases.
- Communication reframing.
- Asking for a short break.
- Crisis resource information when self-harm or immediate danger language appears.

Not allowed:

- Diagnosis.
- Treatment plans.
- Psychotherapy claims.
- Trauma analysis.
- Medication advice.
- Emotion certainty claims.
- Manipulation of other people.

Storage:

- Transient support can be provided when the user asks in the moment.
- Stress profile storage requires explicit opt-in.
- Sensitive stress facts require confirmation.

Crisis boundary:

For self-harm or immediate danger language, GORKH does not continue normal coaching. It recommends local emergency/crisis support and clearly says it is not an emergency service.

`GET /stress/settings` exposes the current opt-in state, locale, crisis resources, and storage policy. France defaults to 3114 and the US optional resource is 988.

Brain Console can exercise opt-in, opt-out, settings, and transient support responses. It must show the support-not-therapy boundary and must not store stress patterns unless the user has opted in and confirmed the sensitive fact.
