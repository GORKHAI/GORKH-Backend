import { config } from "../config.js";
import { mobileError, type MobileErrorShape } from "./errors.js";

export const VOICE_PROTOCOL_VERSION = config.VOICE_PROTOCOL_VERSION;
export const GATEWAY_PROTOCOL_VERSION = config.GATEWAY_PROTOCOL_VERSION;
export const MIN_SUPPORTED_VOICE_PROTOCOL_VERSION = config.MIN_SUPPORTED_VOICE_PROTOCOL_VERSION;
export const MIN_SUPPORTED_GATEWAY_PROTOCOL_VERSION = config.MIN_SUPPORTED_GATEWAY_PROTOCOL_VERSION;

export interface ProtocolValidationResult {
  ok: boolean;
  warning?: "protocol_version_missing";
  error?: MobileErrorShape;
}

export function validateVoiceProtocolVersion(protocolVersion: number | undefined): ProtocolValidationResult {
  return validateProtocolVersion(protocolVersion, VOICE_PROTOCOL_VERSION, MIN_SUPPORTED_VOICE_PROTOCOL_VERSION, "voice");
}

export function validateGatewayProtocolVersion(protocolVersion: number | undefined): ProtocolValidationResult {
  return validateProtocolVersion(protocolVersion, GATEWAY_PROTOCOL_VERSION, MIN_SUPPORTED_GATEWAY_PROTOCOL_VERSION, "gateway");
}

function validateProtocolVersion(protocolVersion: number | undefined, serverVersion: number, minSupported: number, label: string): ProtocolValidationResult {
  if (protocolVersion === undefined) return { ok: true, warning: "protocol_version_missing" };
  if (!Number.isInteger(protocolVersion) || protocolVersion < minSupported || protocolVersion > serverVersion) {
    return {
      ok: false,
      error: mobileError("unsupported_protocol_version", `Unsupported ${label} protocol version.`, {
        details: { clientProtocolVersion: protocolVersion, minSupportedProtocolVersion: minSupported, serverProtocolVersion: serverVersion },
      }),
    };
  }
  return { ok: true };
}
