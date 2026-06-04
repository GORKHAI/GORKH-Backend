import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication } from "livekit-client";
import { attachPublication, clearElement, detachPublication, renderParticipantList } from "./media-ui.js";
import type { RoomLogEvent } from "./events.js";

export interface TokenResponse {
  token: string;
  livekitUrl: string;
  roomId: string;
  providerRoomName: string;
  participantRole: "host" | "guest";
  expiresAt: string;
  permissions: {
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
  };
}

export interface LiveKitRoomController {
  room: Room | null;
  connect(response: TokenResponse): Promise<void>;
  leave(): Promise<void>;
}

export function createLiveKitRoomController(input: {
  localContainer: HTMLElement;
  remoteContainer: HTMLElement;
  participantList: HTMLElement;
  log: (event: RoomLogEvent, data?: unknown) => void;
}): LiveKitRoomController {
  let room: Room | null = null;

  function updateParticipants(): void {
    if (!room) return;
    const participants = [
      { identity: room.localParticipant.identity, name: room.localParticipant.name || "You", role: "local" },
      ...Array.from(room.remoteParticipants.values()).map((participant) => ({
        identity: participant.identity,
        name: participant.name,
        role: "remote",
      })),
    ];
    renderParticipantList(input.participantList, participants);
  }

  async function connect(response: TokenResponse): Promise<void> {
    await leave();
    input.log("connecting", { livekitUrl: response.livekitUrl, room: response.providerRoomName, role: response.participantRole });
    room = new Room({ adaptiveStream: true, dynacast: true });
    bindRoomEvents(room);
    await room.connect(response.livekitUrl, response.token);
    input.log("connected", { room: response.providerRoomName });
    updateParticipants();
    if (response.permissions.canPublish) {
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);
      input.log("local_media_started");
      renderLocalTracks();
    }
  }

  async function leave(): Promise<void> {
    if (!room) return;
    const current = room;
    room = null;
    current.localParticipant.trackPublications.forEach((publication) => {
      publication.track?.detach().forEach((node) => node.remove());
    });
    current.disconnect();
    clearElement(input.localContainer);
    clearElement(input.remoteContainer);
    renderParticipantList(input.participantList, []);
    input.log("local_media_stopped");
  }

  function bindRoomEvents(activeRoom: Room): void {
    activeRoom
      .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        input.log("participant_connected", { identity: participant.identity, name: participant.name });
        updateParticipants();
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        input.log("participant_disconnected", { identity: participant.identity });
        updateParticipants();
      })
      .on(RoomEvent.TrackSubscribed, (_track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        attachPublication(input.remoteContainer, participant, publication);
        input.log("track_subscribed", { identity: participant.identity, kind: publication.kind });
      })
      .on(RoomEvent.TrackUnsubscribed, (_track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        detachPublication(input.remoteContainer, publication);
        input.log("track_unsubscribed", { identity: participant.identity, kind: publication.kind });
      })
      .on(RoomEvent.Disconnected, (reason) => {
        input.log("disconnected", { reason });
        clearElement(input.localContainer);
        clearElement(input.remoteContainer);
        updateParticipants();
      });
  }

  function renderLocalTracks(): void {
    clearElement(input.localContainer);
    if (!room) return;
    room.localParticipant.trackPublications.forEach((publication) => {
      const track = publication.track;
      if (!track) return;
      const element = track.attach();
      element.classList.add("media-track");
      if (track.kind === Track.Kind.Audio) return;
      input.localContainer.appendChild(element);
    });
  }

  return {
    get room() {
      return room;
    },
    connect,
    leave,
  };
}
