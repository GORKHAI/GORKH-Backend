# Live Audio Test Checklist

Use `/dev/brain` to inspect profile, research, stress, skills, audit, and session privacy state before and after `/dev/live` tests.

Use this checklist from the forwarded `/dev/live` gateway URL. Do not claim ASR success unless a real browser microphone produces a real Deepgram final transcript.

## Test A: Typed Preparation Without LLM

- Policy: `conversation_agent`
- Input: `typed_text`
- Ask: `What should I ask before this bank loan meeting?`
- Expect deterministic assistant text.
- Expect `voice_speak_request` and `gateway_client_tts_instruction`.

## Test B: Typed Open-Ended With DeepSeek

- Policy: `conversation_agent`
- Input: `typed_text`
- Ask: `Explain APR in simple terms.`
- If `DEEPSEEK_API_KEY` is configured, expect real DeepSeek assistant text.
- If not configured, expect `provider_not_configured`.

## Test C: Typed Whisper

- Policy: `whisper_copilot`
- Input: `typed_text`
- Transcript: `The APR is 9.4 percent and there is also an arrangement fee.`
- Expect `voice_cue`.
- Expect `gateway_client_tts_instruction`.

## Test D: Microphone Conversation Agent With Deepgram

- Set `DEEPGRAM_API_KEY`.
- Set `VOICE_GATEWAY_ASR_PROVIDER=deepgram`.
- Policy: `conversation_agent`
- Input: `microphone_pcm16`
- Say: `What should I ask before this bank loan meeting?`
- Expect `gateway_asr_final`.
- Expect deterministic assistant text.
- Expect browser SpeechSynthesis.

## Test E: Microphone Open-Ended Agent With Deepgram And DeepSeek

- Set `DEEPGRAM_API_KEY`.
- Set `DEEPSEEK_API_KEY`.
- Policy: `conversation_agent`
- Input: `microphone_pcm16`
- Say: `Explain APR in simple terms.`
- Expect `gateway_asr_final`.
- Expect real DeepSeek assistant text.
- Expect browser SpeechSynthesis.

## Test F: Microphone Whisper Bank With Deepgram

- Policy: `whisper_copilot`
- Input: `microphone_pcm16`
- Say: `The APR is 9.4 percent and there is also an arrangement fee.`
- Expect `gateway_asr_final`.
- Expect trigger and cue events.
- Expect a short browser TTS cue.

## Test G: Doctor Safety

- Policy: `whisper_copilot`
- Scenario: `doctor_visit`
- Say: `We should discuss your blood test result and medication side effects.`
- Expect a safe cue.
- Expect no diagnosis or treatment recommendation.

## Test H: Barge-In

- Trigger assistant speech.
- Click `Simulate Barge-In` or start speaking.
- Expect browser SpeechSynthesis cancellation.
- Expect `voice_cancel_speech`.

## Test I: Privacy Stop Discard

- Click `Stop Save=false`.
- Verify backend session status is `discarded`.
- Verify no transcript, cue, suggestion, turn, or voice output retention.

## Test J: Disconnect Without Stop

- Click `Disconnect Without Stop`.
- Verify backend session status is `interrupted`.
- Verify no auto-save and no memory extraction.

## Render Manual Validation

After deployment:

- Open `LIVE_GATEWAY_URL/dev/live`.
- Create or use the smoke user.
- Start `conversation_agent` with `typed_text`.
- Ask: `What should I ask before this bank loan meeting?`
- Verify deterministic assistant text and client TTS instruction.
- Start `conversation_agent` with `microphone_pcm16`.
- Say: `What should I ask before this bank loan meeting?`
- Verify real `gateway_asr_final`, assistant text, and browser SpeechSynthesis if unmuted.
- Start `whisper_copilot` with `microphone_pcm16`.
- Say: `The APR is 9.4 percent and there is also an arrangement fee.`
- Verify real ASR final, trigger/cue events, and short client-side TTS cue.
- Click `Stop Save=false`.
- Verify discarded session state and zero retained transcript/cue/output counts.

Do not claim browser microphone ASR success until a real browser microphone test produces a real Deepgram final transcript.

## Brain Console Manual Validation

Open `LIVE_GATEWAY_URL/dev/brain` and verify:

- Dashboard loads.
- Profile review separates confirmed, proposed, sensitive, and rejected facts.
- Stress settings and support are visible.
- Skills can be approved/enabled/disabled.
- Action proposals can be approved/rejected and only safe internal actions execute.
- Connector permissions show external actions disabled.
- Subagent queue metrics and notifications load.
- Research provider status is accurate.
- Audit events load without secrets.
- Session privacy panel shows discarded content is deleted.
