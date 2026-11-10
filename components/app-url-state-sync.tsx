"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useProject } from "@/lib/project-context";
import {
  appUrlStateMatchesContext,
  mergeAppUrlStateIntoSearchParams,
  parseAppUrlState,
} from "@/lib/url-app-state";

const SKIP_PATHS = new Set(["/login", "/"]);

function hasAnyAppStateParam(params: URLSearchParams): boolean {
  return (
    params.has("projectId") ||
    params.has("range") ||
    params.has("from") ||
    params.has("to")
  );
}

function contextSnapshot(context: {
  projectId?: string | null;
  timeRange: string;
  customDateRange: { from?: Date; to?: Date };
}) {
  return {
    projectId: context.projectId ?? null,
    timeRange: context.timeRange,
    fromMs: context.customDateRange.from?.getTime() ?? null,
    toMs: context.customDateRange.to?.getTime() ?? null,
  };
}

export function AppUrlStateSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  const {
    user,
    projects,
    selectedProject,
    isLoading,
    timeRange,
    customDateRange,
    selectProject,
    setTimeRange,
    setCustomDateRange,
  } = useProject();

  const applyingFromUrlRef = useRef(false);
  const didSeedUrlRef = useRef(false);
  const lastContextRef = useRef<string>("");

  const currentContextKey = JSON.stringify(
    contextSnapshot({ projectId: selectedProject?.id, timeRange, customDateRange })
  );

  // URL → context (back/forward, pasted link, shared URL)
  useEffect(() => {
    if (isLoading || !user || SKIP_PATHS.has(pathname)) return;
    if (!hasAnyAppStateParam(searchParams)) return;
    if (
      appUrlStateMatchesContext(searchParams, {
        projectId: selectedProject?.id,
        timeRange,
        customDateRange,
      })
    ) {
      lastContextRef.current = currentContextKey;
      return;
    }

    const parsed = parseAppUrlState(searchParams);
    applyingFromUrlRef.current = true;

    void (async () => {
      try {
        if (
          parsed.projectId &&
          parsed.projectId !== selectedProject?.id &&
          projects.some((p) => p.id === parsed.projectId)
        ) {
          await selectProject(parsed.projectId);
        }

        if (parsed.timeRange === "custom") {
          if (timeRange !== "custom") await setTimeRange("custom");
          await setCustomDateRange(parsed.customDateRange);
        } else {
          if (timeRange !== parsed.timeRange) await setTimeRange(parsed.timeRange);
          if (timeRange === "custom" || customDateRange.from || customDateRange.to) {
            await setCustomDateRange({});
          }
        }
      } finally {
        applyingFromUrlRef.current = false;
        lastContextRef.current = currentContextKey;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL string is the source of truth
  }, [searchKey, isLoading, user, pathname, projects.length]);

  // Context → URL: push history on user-driven changes; replace once to seed missing params
  useEffect(() => {
    if (isLoading || !user || SKIP_PATHS.has(pathname)) return;
    if (applyingFromUrlRef.current) return;

    const merged = mergeAppUrlStateIntoSearchParams(searchParams, {
      projectId: selectedProject?.id,
      timeRange,
      customDateRange,
    });
    const href = merged ? `${pathname}?${merged}` : pathname;

    if (merged === searchKey) {
      lastContextRef.current = currentContextKey;
      if (hasAnyAppStateParam(searchParams)) didSeedUrlRef.current = true;
      return;
    }

    const contextChanged = lastContextRef.current !== "" && lastContextRef.current !== currentContextKey;
    lastContextRef.current = currentContextKey;

    if (!didSeedUrlRef.current && !hasAnyAppStateParam(searchParams)) {
      didSeedUrlRef.current = true;
      router.replace(href, { scroll: false });
      return;
    }

    if (contextChanged) {
      router.push(href, { scroll: false });
    }
  }, [
    currentContextKey,
    pathname,
    isLoading,
    user,
    searchKey,
    router,
    searchParams,
    selectedProject?.id,
    timeRange,
    customDateRange.from?.getTime(),
    customDateRange.to?.getTime(),
  ]);

  return null;
}
