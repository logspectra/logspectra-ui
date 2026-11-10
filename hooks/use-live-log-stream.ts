"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeLiveLogStream } from "@/lib/live-log-stream";
import type { LogEntry } from "@/lib/types";

export type LiveStreamStatus = "idle" | "connecting" | "live" | "reconnecting";

export type UseLiveLogStreamOptions = {
  projectId?: string;
  enabled?: boolean;
  service?: string;
  level?: string;
  onLog: (log: LogEntry) => void;
};

/**
 * React adapter around the shared SSE transport (subscribe / unsubscribe lifecycle).
 */
export function useLiveLogStream({
  projectId,
  enabled = true,
  service,
  level,
  onLog,
}: UseLiveLogStreamOptions): { status: LiveStreamStatus } {
  const [status, setStatus] = useState<LiveStreamStatus>("idle");
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  useEffect(() => {
    if (!enabled || !projectId) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");

    const unsubscribe = subscribeLiveLogStream({
      projectId,
      service,
      level,
      onConnected: () => setStatus("live"),
      onError: () => setStatus("reconnecting"),
      onLog: (log) => onLogRef.current(log),
    });

    return unsubscribe;
  }, [enabled, projectId, service, level]);

  return { status };
}
