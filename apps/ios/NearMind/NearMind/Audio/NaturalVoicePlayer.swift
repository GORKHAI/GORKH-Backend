import AVFoundation
import Foundation

enum NaturalVoicePlaybackStatus: String, Equatable {
    case idle
    case loading
    case playing
    case failed
    case fallbackNative
}

@MainActor
protocol NaturalVoicePlaying: AnyObject {
    var playbackStatus: NaturalVoicePlaybackStatus { get }
    func play(audioData: Data) throws
    func stop()
}

@MainActor
final class NaturalVoicePlayer: NSObject, NaturalVoicePlaying, AVAudioPlayerDelegate {
    private var player: AVAudioPlayer?
    private(set) var playbackStatus: NaturalVoicePlaybackStatus = .idle

    func play(audioData: Data) throws {
        stop()
        let player = try AVAudioPlayer(data: audioData)
        player.delegate = self
        player.prepareToPlay()
        player.play()
        self.player = player
        playbackStatus = .playing
    }

    func stop() {
        player?.stop()
        player = nil
        playbackStatus = .idle
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            if self.player === player {
                self.player = nil
                self.playbackStatus = .idle
            }
        }
    }
}
