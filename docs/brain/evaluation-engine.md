# Evaluation Engine

The evaluation engine records non-secret quality events in `evaluation_events`.

Targets:

- `research_answer`
- `cue`
- `assistant_text`
- `subagent_report`
- `action_proposal`
- `daily_brief`

Research evaluation checks citation backing, high-stakes caveats, overclaiming, unsupported directives, and answer length.

Cue evaluation checks spoken cue word count, transcript-to-cue latency, delivery channel, and whether whisper mode avoided long speech.

Evaluations warn by default. Runtime behavior should fail only on clear safety violations such as fabricated citations or long earbud cues.
