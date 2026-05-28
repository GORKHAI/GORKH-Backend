export const mobileGatewayEventTypes = [
  "gateway_ack",
  "gateway_state",
  "gateway_provider_error",
  "gateway_asr_partial",
  "gateway_asr_final",
  "gateway_client_tts_instruction",
  "gateway_metrics",
  "gateway_warning",
  "gateway_error",
] as const;

export type MobileGatewayEventType = (typeof mobileGatewayEventTypes)[number];
