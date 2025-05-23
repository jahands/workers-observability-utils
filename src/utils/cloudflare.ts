export type TraceItemTrigger =
  | "unknown"
  | "fetch"
  | "rpc"
  | "websocket"
  | "email"
  | "queue"
  | "cron"
  | "scheduled";

export function getEventTrigger(traceItem: TraceItem): TraceItemTrigger {
  const event = traceItem.event;
  if (!event) {
    return "unknown";
  }
  if ("request" in event) {
    return "fetch";
  }

  if ("rpcMethod" in event) {
    return "rpc";
  }

  if ("webSocketEventType" in event) {
    return "websocket";
  }

  if ("mailFrom" in event) {
    return "email";
  }

  if ("queue" in event) {
    return "queue";
  }

  if ("cron" in event) {
    return "cron";
  }
  if ("scheduled" in event) {
    return "scheduled";
  }

  return "unknown";
}
