import { api, tokenStore } from "@/lib/api";
import type { LogEntry } from "@/lib/types";
import type { User } from "@/lib/types";

export type StreamLogDocument = {
  id?: string;
  projectId?: string;
  timestamp?: string | number | number[];
  level?: string;
  service?: string;
  traceId?: string;
  message?: string;
  endpoint?: string;
  exception?: string;
  stackTrace?: string;
  mdc?: {
    traceId?: string;
    endpoint?: string;
  };
};

const SUPPORTED_LEVELS: Array<LogEntry["level"]> = ["DEBUG", "INFO", "WARN", "ERROR"];

const normalizeLevel = (value?: string): LogEntry["level"] => {
  if (!value) return "INFO";
  const upper = value.toUpperCase();
  return SUPPORTED_LEVELS.includes(upper as LogEntry["level"])
    ? (upper as LogEntry["level"])
    : "INFO";
};

const parseTimestamp = (value?: string | number | number[]): Date => {
  if (Array.isArray(value)) {
    // Jackson sometimes serializes Instant as [epochSecond, nano]
    const seconds = value[0] ?? 0;
    const nanos = value[1] ?? 0;
    return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
  }
  if (typeof value === "number") {
    return new Date(value > 1_000_000_000_000 ? value : value * 1000);
  }
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
};

const resolveTraceId = (value: StreamLogDocument): string =>
  value.traceId?.trim() || value.mdc?.traceId?.trim() || "";

export const logEntryFromStreamDocument = (value: StreamLogDocument): LogEntry => ({
  id: value.id || `${Date.now()}-${Math.random()}`,
  timestamp: parseTimestamp(value.timestamp),
  level: normalizeLevel(value.level),
  service: value.service || "unknown-service",
  traceId: resolveTraceId(value),
  message: value.endpoint ? `${value.message || ""} (${value.endpoint})` : (value.message || ""),
  stackTrace: value.stackTrace || value.exception,
});

export type LiveLogStreamOptions = {
  projectId: string;
  service?: string;
  level?: string;
  onConnected?: () => void;
  onLog: (log: LogEntry) => void;
  onError?: (error: unknown) => void;
};

export function subscribeLiveLogStream(options: LiveLogStreamOptions): () => void {
  let isActive = true;
  let abortController: AbortController | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  };

  const processEvent = (eventName: string, data: string) => {
    if (eventName === "connected") {
      options.onConnected?.();
      return;
    }
    if (!data) return;

    try {
      const parsed = JSON.parse(data) as StreamLogDocument;
      if (parsed.message || parsed.service || parsed.level) {
        options.onLog(logEntryFromStreamDocument(parsed));
      }
    } catch (error) {
      options.onError?.(error);
    }
  };

  const connect = async () => {
    if (!isActive) return;
    clearReconnect();

    if (abortController) abortController.abort();
    abortController = new AbortController();

    const streamUrl = api.getLiveLogsStreamUrl({
      projectId: options.projectId,
      service: options.service,
      level: options.level,
    });

    const headers = new Headers();
    headers.set("Accept", "text/event-stream");
    const token = tokenStore.get();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Project-Id", options.projectId);

    const currentUser =
      typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser) as User;
        if (user.id) headers.set("X-User-Id", user.id);
      } catch {
        // ignore malformed cached user
      }
    }

    try {
      const response = await fetch(streamUrl, {
        method: "GET",
        headers,
        signal: abortController.signal,
        cache: "no-store",
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE stream failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (isActive) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          let eventName = "message";
          const dataLines: string[] = [];

          for (const line of rawEvent.split("\n")) {
            if (!line || line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart());
            }
          }

          processEvent(eventName, dataLines.join("\n"));
        }
      }

      if (isActive) {
        reconnectTimeout = setTimeout(() => void connect(), 3000);
      }
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (!aborted && isActive) {
        options.onError?.(error);
        reconnectTimeout = setTimeout(() => void connect(), 3000);
      }
    }
  };

  void connect();

  return () => {
    isActive = false;
    clearReconnect();
    abortController?.abort();
  };
}
