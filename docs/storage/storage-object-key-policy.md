# Storage Object Key Policy

Object keys use IDs only.

Good:

```text
nearmind/users/u_<uuid>/sessions/s_<uuid>/objects/o_<uuid>.json
nearmind/users/u_<uuid>/exports/e_<uuid>/objects/o_<uuid>.json
nearmind/users/u_<uuid>/rooms/r_<uuid>/objects/o_<uuid>.json
```

Bad:

```text
users/gorkh/doctor-meeting-audio.wav
users/person@example.com/bank-loan-transcript.json
```

Rules:

- no emails
- no names
- no raw titles
- no PII
- no original filenames in keys
- no provider credentials

