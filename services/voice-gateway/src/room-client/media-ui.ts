import type { Participant, TrackPublication } from "livekit-client";
import { Track } from "livekit-client";

export function clearElement(target: HTMLElement): void {
  while (target.firstChild) target.removeChild(target.firstChild);
}

export function attachPublication(container: HTMLElement, participant: Participant, publication: TrackPublication): void {
  const track = publication.track;
  if (!track) return;
  const element = track.attach();
  element.dataset.participantIdentity = participant.identity;
  element.dataset.trackSid = publication.trackSid;
  element.classList.add("media-track");
  if (track.kind === Track.Kind.Audio) {
    element.setAttribute("autoplay", "true");
  }
  container.appendChild(wrapTrack(participant.identity, element));
}

export function detachPublication(container: HTMLElement, publication: TrackPublication): void {
  const selector = `[data-track-sid="${cssEscape(publication.trackSid)}"]`;
  const element = container.querySelector(selector);
  const wrapper = element?.parentElement;
  publication.track?.detach().forEach((node) => node.remove());
  wrapper?.remove();
}

export function renderParticipantList(target: HTMLElement, participants: Array<{ identity: string; name?: string; role?: string }>): void {
  target.innerHTML = "";
  for (const participant of participants) {
    const item = document.createElement("li");
    item.textContent = `${participant.name || participant.identity}${participant.role ? ` (${participant.role})` : ""}`;
    target.appendChild(item);
  }
}

function wrapTrack(identity: string, element: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "track-card";
  const label = document.createElement("span");
  label.className = "track-label";
  label.textContent = identity;
  wrapper.appendChild(label);
  wrapper.appendChild(element);
  return wrapper;
}

function cssEscape(value: string): string {
  if ("CSS" in window && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
