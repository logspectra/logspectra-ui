"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, CheckCircle2, Copy, Loader2, Sparkles } from "lucide-react";
import type { AnalysisStreamEvent } from "@/lib/api";
import type { AnalysisResult } from "@/lib/types";

const severityBadgeClasses: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-100",
  LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
};

const priorityBadgeClasses: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
  LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
};

interface AIAnalysisPanelProps {
  result?: AnalysisResult | null;
  events?: AnalysisStreamEvent[];
  isStreaming?: boolean;
  error?: string;
  traceId?: string;
  onClose?: () => void;
}

const formatTimestamp = (timestamp?: string): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString();
};

export function AIAnalysisPanel({
  result = null,
  events = [],
  isStreaming = false,
  error = "",
  traceId,
  onClose,
}: AIAnalysisPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const lastProgressIndex = [...events].map((event) => event.type).lastIndexOf("progress");

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!result && !isStreaming && events.length === 0 && !error) return null;

  const latestStatus = error
    ? "error"
    : isStreaming
      ? "streaming"
      : result
        ? "complete"
        : "idle";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-muted/20 p-4 text-card-foreground shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-foreground">AI Analysis Stream</h4>
              <Badge
                className={
                  latestStatus === "error"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100"
                    : latestStatus === "streaming"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
                }
              >
                {latestStatus === "streaming" ? "Streaming" : latestStatus === "complete" ? "Complete" : latestStatus === "error" ? "Error" : "Idle"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {traceId ? `Trace ID: ${traceId}` : "Streaming analysis updates from the backend"}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {events.length > 0 ? (
            events.map((event, index) => {
              const isComplete = event.type === "complete";
              const isResult = event.type === "result";
              const isActiveProgress = event.type === "progress" && index === lastProgressIndex && isStreaming;
              return (
                <div
                  key={`${event.type}-${index}-${event.timestamp ?? event.message}`}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background/70 px-3 py-2"
                >
                  <div
                    className={
                      isComplete
                        ? "mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500"
                        : isResult
                          ? "mt-1 h-2.5 w-2.5 rounded-full bg-blue-500"
                          : isActiveProgress
                            ? "mt-1 h-2.5 w-2.5 rounded-full bg-sky-500 animate-pulse"
                            : "mt-1 h-2.5 w-2.5 rounded-full bg-sky-300"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          isComplete
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100"
                            : isResult
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-100"
                              : "bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-100"
                        }
                      >
                        {event.type}
                      </Badge>
                      {event.timestamp && (
                        <span className="text-xs text-muted-foreground">{formatTimestamp(event.timestamp)}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{event.message}</p>
                  </div>
                  {isComplete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  ) : isResult ? (
                    <Check className="mt-0.5 h-4 w-4 text-blue-500" />
                  ) : isActiveProgress ? (
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-sky-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-500" />
                  )}
                </div>
              );
            })
          ) : isStreaming ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background/70 px-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
              <span className="text-sm text-foreground">Waiting for analysis progress...</span>
            </div>
          ) : null}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 text-card-foreground">
            <div className="flex items-center gap-3">
              <Badge className={severityBadgeClasses[result.severity] ?? severityBadgeClasses.LOW}>
                {result.severity}
              </Badge>
              <div>
                <p className="text-sm text-muted-foreground">Confidence</p>
                <p className="font-semibold text-foreground">{result.confidence}%</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">Service</p>
                <p className="font-semibold text-foreground">{result.service}</p>
              </div>
            </div>
          </div>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Error Summary</h4>
            <p className="text-sm text-muted-foreground">{result.errorSummary}</p>
          </Card>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Root Cause</h4>
            <p className="text-sm text-muted-foreground">{result.rootCause}</p>
          </Card>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Suggested Fixes</h4>
            {result.suggestedFixes.length > 0 ? (
              result.suggestedFixes.map((fix, index) => (
                <Card key={index} className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={priorityBadgeClasses[fix.priority] ?? priorityBadgeClasses.LOW}>
                        {fix.priority}
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                        {fix.effort}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(fix.code, index)}>
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{fix.description}</p>
                  <code className="block overflow-x-auto rounded border border-border bg-muted p-2 text-xs text-foreground">
                    {fix.code}
                  </code>
                </Card>
              ))
            ) : (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">No automated fixes were returned.</p>
              </Card>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {result.cached ? "Cached" : "Fresh"} • Analyzed at {result.analyzedAt.toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
