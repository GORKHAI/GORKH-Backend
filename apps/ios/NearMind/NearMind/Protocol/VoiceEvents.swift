import Foundation

enum VoiceEventType: String, CaseIterable {
    case voiceAck = "voice_ack"
    case voiceState = "voice_state"
    case voiceSegment = "voice_segment"
    case voiceTriggers = "voice_triggers"
    case voiceCue = "voice_cue"
    case voiceAssistantText = "voice_assistant_text"
    case voiceSpeakRequest = "voice_speak_request"
    case voiceCancelSpeech = "voice_cancel_speech"
    case voiceSubagentStarted = "voice_subagent_started"
    case voiceSubagentProgress = "voice_subagent_progress"
    case voiceSubagentReport = "voice_subagent_report"
    case voiceSubagentFailed = "voice_subagent_failed"
}
