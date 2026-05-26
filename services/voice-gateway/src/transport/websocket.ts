import type { RawData, WebSocket } from "ws";
import { GatewaySession } from "../session.js";
import type { GatewayServerEvent } from "../types.js";

export function attachGatewayVoiceSocket(socket: WebSocket, userId: string, token: string): GatewaySession {
  const emit = (event: GatewayServerEvent): void => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
  };
  const session = new GatewaySession(userId, token, emit);
  let queue = Promise.resolve();

  socket.on("message", (data: RawData, isBinary: boolean) => {
    queue = queue
      .then(() => (isBinary ? session.handleBinary(data) : session.handleText(rawDataToBuffer(data).toString("utf8"))))
      .catch((err) => emit({ type: "gateway_error", stage: "handler", message: String((err as Error).message ?? err) }));
  });

  socket.on("close", () => {
    void session.disconnect().catch(() => undefined);
  });

  return session;
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}
