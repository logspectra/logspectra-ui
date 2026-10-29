"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  Loader2,
  Wrench,
} from "lucide-react";
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
  providerLabel?: string;
  isApplyingFix?: boolean;
  fixError?: string;
  onApplyFix?: () => void;
  onClose?: () => void;
}

const formatTimestamp = (timestamp?: string): string | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString();
};

const humanizeProgress = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed) return "Working…";
  if (trimmed.toLowerCase().startsWith("starting log analysis")) {
    return "Collecting trace logs and starting the debug agent";
  }
  return trimmed;
};

export function AIAnalysisPanel({
  result = null,
  events = [],
  isStreaming = false,
  error = "",
  traceId,
  providerLabel,
  isApplyingFix = false,
  fixError = "",
  onApplyFix,
  onClose,
}: AIAnalysisPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showLiveOutput, setShowLiveOutput] = useState(true);
  const liveOutputRef = useRef<HTMLPreElement>(null);

  const timelineEvents = useMemo(
    () => events.filter((e) => e.type === "progress" || e.type === "complete" || e.type === "error"),
    [events]
  );

  const liveTokens = useMemo(() => events.filter((e) => e.type === "token").map((e) => e.message).join(""), [events]);

  const streamError = useMemo(() => {
    const fromEvent = [...events].reverse().find((e) => e.type === "error");
    return error || fromEvent?.message || "";
  }, [events, error]);

  useEffect(() => {
    if (liveOutputRef.current && isStreaming) {
      liveOutputRef.current.scrollTop = liveOutputRef.current.scrollHeight;
    }
  }, [liveTokens, isStreaming]);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!result && !isStreaming && events.length === 0 && !streamError) return null;

  const partialSuccess = Boolean(result && streamError);
  const phase = result
    ? "done"
    : streamError
      ? "failed"
      : isStreaming
        ? "running"
        : "idle";

  const sessionSettled = phase === "done" || phase === "failed";
  const hasApplicableFix =
    !!result?.suggestedFixes?.some(
      (fix) => fix.filePath && (fix.search || fix.newContent || fix.replace)
    );

  const steps = [
    { id: "logs", label: "Trace logs", done: timelineEvents.length > 0 || !!result || sessionSettled },
    {
      id: "agent",
      label: "AI debug agent",
      done: liveTokens.length > 0 || !!result || sessionSettled,
      active: isStreaming && timelineEvents.length > 0 && !result && !sessionSettled,
    },
    {
      id: "fix",
      label: "Diagnosis",
      done: !!result || (sessionSettled && phase === "failed"),
      active: isStreaming && liveTokens.length > 0 && !result && !sessionSettled,
    },
  ];

  const visibleTimeline = timelineEvents.slice(-4);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-50 via-card to-blue-50/40 p-4 shadow-sm dark:from-slate-950 dark:via-card dark:to-blue-950/20">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                <Bug className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">Debug session</h4>
              <Badge
                className={
                  phase === "failed"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100"
                    : phase === "running"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
                }
              >
                {phase === "running"
                  ? "In progress"
                  : phase === "done"
                    ? partialSuccess
                      ? "Complete (warning)"
                      : "Complete"
                    : phase === "failed"
                      ? "Failed"
                      : "Ready"}
              </Badge>
              {providerLabel && (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  {providerLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {traceId ? `Trace ${traceId}` : "Streaming from LogSpectra backend"}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-0">
          {steps.map((step, index) => (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-start sm:px-2">
              <div className="flex w-full items-center gap-2">
                <span
                  className={
                    step.done
                      ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                      : step.active
                        ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-background"
                        : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted"
                  }
                >
                  {step.done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground">{index + 1}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-foreground sm:hidden">{step.label}</span>
                {index < steps.length - 1 && <div className="hidden h-px flex-1 bg-border sm:block" />}
              </div>
              <span className="hidden pl-8 text-xs text-muted-foreground sm:block">{step.label}</span>
            </li>
          ))}
        </ol>

        {visibleTimeline.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {visibleTimeline.map((event, index) => {
              const isLiveProgress =
                event.type === "progress" && isStreaming && index === visibleTimeline.length - 1;
              return (
              <div
                key={`${event.type}-${index}-${event.timestamp ?? event.message}`}
                className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
              >
                {event.type === "error" ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                ) : event.type === "complete" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                ) : isLiveProgress ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-500" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/80" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-foreground">{humanizeProgress(event.message)}</p>
                  {event.timestamp && (
                    <p className="text-[11px] text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {isStreaming && timelineEvents.length === 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 px-3 py-3 dark:border-blue-900/50 dark:bg-blue-950/20">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-foreground">Connecting to the debug pipeline…</span>
          </div>
        )}

        {(liveTokens.length > 0 || (isStreaming && phase === "running")) && (
          <div className="mt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-t-lg border border-border bg-muted/50 px-3 py-2 text-left text-xs font-medium text-foreground"
              onClick={() => setShowLiveOutput((v) => !v)}
            >
              <span>Agent output {isStreaming ? "(live)" : ""}</span>
              {showLiveOutput ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showLiveOutput && (
              <pre
                ref={liveOutputRef}
                className="max-h-40 overflow-auto rounded-b-lg border border-t-0 border-border bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-100"
              >
                {liveTokens || (isStreaming ? "…" : "")}
              </pre>
            )}
          </div>
        )}

        {streamError && (
          <div
            className={
              partialSuccess
                ? "mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                : "mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
            }
          >
            {partialSuccess
              ? `Analysis finished, but saving to the issue registry failed: ${streamError}`
              : streamError}
          </div>
        )}
      </div>

      {result?.remediationPrUrl && (
        <Card className="border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-foreground">Remediation pull request opened</p>
                <p className="text-xs text-muted-foreground">
                  {result.remediationBranch ? `Branch ${result.remediationBranch}` : "GitHub"}
                  {result.remediationPrNumber != null ? ` · PR #${result.remediationPrNumber}` : ""}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
              <a href={result.remediationPrUrl} target="_blank" rel="noopener noreferrer">
                View on GitHub
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Badge className={severityBadgeClasses[result.severity] ?? severityBadgeClasses.LOW}>{result.severity}</Badge>
            <div>
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-sm font-semibold text-foreground">
                {Math.round(result.confidence <= 1 ? result.confidence * 100 : result.confidence)}%
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="text-sm font-semibold text-foreground">{result.service}</p>
            </div>
            {result.cached && (
              <Badge variant="secondary" className="ml-auto">Cached result</Badge>
            )}
          </div>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">What happened</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.errorSummary}</p>
          </Card>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Root cause</h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.rootCause}</p>
          </Card>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">Suggested fixes</h4>
              {onApplyFix && hasApplicableFix && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={
                    isApplyingFix
                    || isStreaming
                    || !!result.remediationPrUrl
                    || !result.fingerprint
                  }
                  onClick={onApplyFix}
                  title={
                    !result.fingerprint
                      ? "Re-run Debug after the backend stores the issue fingerprint (Apply fix needs it)."
                      : undefined
                  }
                >
                  {isApplyingFix ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="mr-2 h-4 w-4" />
                  )}
                  {result.remediationPrUrl ? "Fix applied" : isApplyingFix ? "Applying…" : "Apply fix on GitHub"}
                </Button>
              )}
            </div>
            {fixError && (
              <p className="text-sm text-red-600 dark:text-red-400">{fixError}</p>
            )}
            {result.suggestedFixes.length > 0 ? (
              result.suggestedFixes.map((fix, index) => (
                <Card key={`${fix.filePath ?? "fix"}-${index}`} className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {fix.filePath && (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-foreground">
                          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {fix.filePath}
                        </span>
                      )}
                      <Badge variant="secondary" className={priorityBadgeClasses[fix.priority] ?? priorityBadgeClasses.LOW}>
                        {fix.priority}
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                        {fix.effort}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleCopyCode(fix.replace || fix.newContent || fix.code, index)}>
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2 p-4">
                    <p className="text-sm text-muted-foreground">{fix.description}</p>
                    {fix.search && fix.replace != null ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Search / replace patch</p>
                        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                          {`<<<<<<< SEARCH\n${fix.search}\n=======\n${fix.replace}\n>>>>>>> REPLACE`}
                        </pre>
                      </div>
                    ) : (
                      (fix.newContent || fix.code) && (
                        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                          {fix.newContent || fix.code}
                        </pre>
                      )
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">No code changes were proposed. Review the root cause above.</p>
              </Card>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Analyzed at {result.analyzedAt.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
