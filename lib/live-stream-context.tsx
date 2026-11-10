"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "logspectra-sse-enabled";

type LiveStreamContextValue = {
  /** When false, Dashboard / Explorer skip SSE (Live page is always on). */
  sseEnabled: boolean;
  setSseEnabled: (enabled: boolean) => void;
};

const LiveStreamContext = createContext<LiveStreamContextValue | null>(null);

export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const [sseEnabled, setSseEnabledState] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        setSseEnabledState(stored === "true");
      }
    } catch {
      // ignore private mode / blocked storage
    }
  }, []);

  const setSseEnabled = useCallback((enabled: boolean) => {
    setSseEnabledState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ sseEnabled, setSseEnabled }),
    [sseEnabled, setSseEnabled]
  );

  return <LiveStreamContext.Provider value={value}>{children}</LiveStreamContext.Provider>;
}

export function useLiveStreamPreference(): LiveStreamContextValue {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) {
    return {
      sseEnabled: true,
      setSseEnabled: () => {},
    };
  }
  return ctx;
}
