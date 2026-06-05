# NearMind iOS Audio Route Notes

## Route Setup

Live Assist configures `AVAudioSession` with `.playAndRecord` and `.voiceChat`. Bluetooth routes are allowed where available, and default output uses the speaker unless the user has selected headphones or Bluetooth.

The Live Assist screen displays the current input and output route, including built-in mic, speaker, headphones, Bluetooth, receiver, or other routes. If the active input route disappears during microphone streaming, NearMind stops capture and reports the route failure.

## Real Meeting Guidance

- Earbuds are useful for hearing native TTS privately.
- The phone microphone can capture room audio better than an earbud microphone in meetings, especially when the phone is placed near the conversation.
- Native TTS routes through the current iOS output route.
- Mute TTS if spoken cues would be inappropriate in the room.

## Background Recording

Background recording is disabled intentionally in v0.3. When the app enters background during a Live Assist session, NearMind stops the microphone, stops local TTS, and sends `stop save=false`. The user must manually restart the session after returning to the app.
