"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "@/lib/project-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AIAnalysisPanel } from "../../components/ai-analysis-panel";
import { api, type AnalyzeProvider, resolveDateWindow } from "@/lib/api";
import { useLiveLogStream } from "@/hooks/use-live-log-stream";
import { useLiveStreamPreference } from "@/lib/live-stream-context";
import type { AnalysisStreamEvent } from "@/lib/api";
import type { AnalysisResult, LogEntry } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, Bug, Copy, Check, CheckCircle2 } from "lucide-react";

export default function LogExplorer() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const { sseEnabled } = useLiveStreamPreference();
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [level, setLevel] = useState("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisStreamEvent[]>([]);
  const [analysisError, setAnalysisError] = useState("");
  const [createRemediationPr, setCreateRemediationPr] = useState(false);
  const [analyzeProvider, setAnalyzeProvider] = useState<AnalyzeProvider>("OPENAI");
  const [copiedTraceId, setCopiedTraceId] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isResolving, setIsResolving] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const LevelColors: Record<string, string> = {
    ERROR: "#ef4444",
    WARN: "#eab308",
    INFO: "#3b82f6",
    DEBUG: "#71717a",
  };

  const getDateWindowForSearch = (): { from: string; to: string } | null => {
    const window = resolveDateWindow(timeRange, customDateRange);
    return window ? { from: window.from, to: window.to } : null;
  };

  useEffect(() => {
    const window = getDateWindowForSearch();
    if (!selectedProject || !window) {
      setLogs([]);
      setTotalLogs(0);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsLoadingLogs(true);
      try {
        const result = await api.searchLogs({
          from: window.from,
          to: window.to,
          query: search.trim() ? search.trim() : undefined,
          service: service !== "all" ? service : undefined,
          level: level !== "all" ? level : undefined,
          page: 0,
          size: 200,
        });

        if (cancelled) return;
        setLogs(result.content || []);
        setTotalLogs(result.totalElements ?? result.content.length);

        if (selectedLog && !(result.content || []).some((item) => item.id === selectedLog.id)) {
          setSelectedLog(null);
          setShowAnalysis(false);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to search logs", error);
        setLogs([]);
        setTotalLogs(0);
      } finally {
        if (!cancelled) setIsLoadingLogs(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    selectedProject?.id,
    timeRange,
    customDateRange.from?.getTime(),
    customDateRange.to?.getTime(),
    search,
    service,
    level,
  ]);

  const onLiveLog = useCallback(
    (incoming: LogEntry) => {
      const searchNeedle = search.trim().toLowerCase();
      if (searchNeedle && !incoming.message.toLowerCase().includes(searchNeedle)) {
        return;
      }

      setLogs((prev) => {
        if (prev.some((entry) => entry.id === incoming.id)) return prev;
        return [incoming, ...prev].slice(0, 200);
      });
      setTotalLogs((count) => count + 1);
    },
    [search]
  );

  useLiveLogStream({
    projectId: selectedProject?.id,
    enabled: sseEnabled && !!selectedProject?.id,
    service: service !== "all" ? service : undefined,
    level: level !== "all" ? level : undefined,
    onLog: onLiveLog,
  });

  useEffect(() => {
    analysisAbortRef.current?.abort();
    setIsAnalyzing(false);
    setAnalysisResult(null);
    setAnalysisEvents([]);
    setAnalysisError("");
    setShowAnalysis(false);
  }, [selectedLog?.id]);

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getAiSettings()
      .then((settings) => {
        if (!cancelled && settings.provider) {
          setAnalyzeProvider(settings.provider);
        }
      })
      .catch(() => {
        // keep default provider
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = useMemo(() => {
    const window = getDateWindowForSearch();
    if (!window) return [] as Array<{ label: string; total: number; errors: number; ts: number }>;

    const fromMs = new Date(window.from).getTime();
    const toMs = new Date(window.to).getTime();
    const spanMs = Math.max(1, toMs - fromMs);
    const spanHours = spanMs / 3600_000;

    let bucketMs = 60 * 60 * 1000;
    if (spanHours <= 2) bucketMs = 5 * 60 * 1000;
    else if (spanHours <= 12) bucketMs = 30 * 60 * 1000;
    else if (spanHours <= 48) bucketMs = 60 * 60 * 1000;
    else if (spanHours <= 24 * 10) bucketMs = 6 * 60 * 60 * 1000;
    else bucketMs = 24 * 60 * 60 * 1000;

    const startMs = Math.floor(fromMs / bucketMs) * bucketMs;
    const bucketCount = Math.min(300, Math.floor((toMs - startMs) / bucketMs) + 1);

    const formatLabel = (ts: number): string => {
      const d = new Date(ts);
      if (bucketMs < 60 * 60 * 1000) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      if (bucketMs < 24 * 60 * 60 * 1000) {
        if (spanHours > 24) {
          return `${d.toLocaleDateString([], { month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString([], { hour: "2-digit" })}`;
        }
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
    };

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const ts = startMs + i * bucketMs;
      return {
        ts,
        label: formatLabel(ts),
        total: 0,
        errors: 0,
      };
    });

    for (const log of logs) {
      const ts = log.timestamp.getTime();
      if (ts < startMs || ts > toMs) continue;
      const index = Math.floor((ts - startMs) / bucketMs);
      if (index < 0 || index >= buckets.length) continue;
      buckets[index].total += 1;
      if (log.level === "ERROR") buckets[index].errors += 1;
    }

    return buckets;
  }, [logs, timeRange, customDateRange.from, customDateRange.to]);

  const services = useMemo(() => {
    const values = new Set([
      ...logs.map((log) => log.service),
    ]);
    if (service !== "all") values.add(service);
    return ["all", ...values];
  }, [logs, service, totalLogs]);
  const unresolvedLogs = useMemo(() => logs.filter((log) => !log.resolved), [logs]);
  const levels = ["all", "ERROR", "WARN", "INFO", "DEBUG"];

  const handleCopyTraceId = () => {
    const traceId = selectedLog?.traceId;
    if (traceId) {
      navigator.clipboard.writeText(traceId);
      setCopiedTraceId(true);
      setTimeout(() => setCopiedTraceId(false), 2000);
    }
  };

  const handleAnalyze = async () => {
    const traceId = selectedLog?.traceId;
    if (!selectedLog || !traceId) return;

    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setIsAnalyzing(true);
    setShowAnalysis(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setAnalysisEvents([]);

    const appendAnalysisEvent = (event: AnalysisStreamEvent) => {
      setAnalysisEvents((prev) => {
        if (event.type === "progress") {
          const lastProgressIndex = prev.map((item) => item.type).lastIndexOf("progress");
          if (lastProgressIndex >= 0) {
            const nextEvents = [...prev];
            nextEvents[lastProgressIndex] = event;
            return nextEvents;
          }
          return [...prev, event];
        }

        if (event.type === "token") {
          const last = prev[prev.length - 1];
          if (last?.type === "token") {
            const nextEvents = [...prev];
            nextEvents[nextEvents.length - 1] = {
              ...last,
              message: last.message + event.message,
            };
            return nextEvents;
          }
          return [...prev, event];
        }

        if (event.type === "error") {
          setAnalysisError(event.message);
        }

        const lastEvent = prev[prev.length - 1];
        if (lastEvent?.type === event.type && lastEvent.message === event.message) {
          return prev;
        }
        return [...prev, event];
      });
    };

    try {
      const analysis = await api.streamAnalyzeLog(traceId, {
        provider: analyzeProvider,
        createRemediationPr,
        signal: controller.signal,
        onProgress: (event) => {
          if (controller.signal.aborted) return;
          appendAnalysisEvent(event);
        },
        onResult: (result) => {
          if (controller.signal.aborted) return;
          setAnalysisResult(result);
          appendAnalysisEvent({
            type: "result",
            message: "Debug diagnosis ready",
            timestamp: new Date().toISOString(),
          });
          setIsAnalyzing(false);
        },
        onComplete: (event) => {
          if (controller.signal.aborted) return;
          appendAnalysisEvent(event);
          setIsAnalyzing(false);
        },
      });

      if (analysis && !controller.signal.aborted) {
        setAnalysisResult(analysis);
        setIsAnalyzing(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("❌ Failed to analyze log:", error);
        setAnalysisError(error instanceof Error ? error.message : "Debug session failed");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
      }
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
      }
    }
  };

  const handleToggleCheckbox = (logId: string) => {
    const targetLog = logs.find((log) => log.id === logId);
    if (targetLog?.resolved) return;

    const newSet = new Set(selectedLogIds);
    if (newSet.has(logId)) {
      newSet.delete(logId);
    } else {
      newSet.add(logId);
    }
    setSelectedLogIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedLogIds.size === unresolvedLogs.length && unresolvedLogs.length > 0) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(unresolvedLogs.map((log) => log.id)));
    }
  };

  const handleResolveLogs = async () => {
    if (selectedLogIds.size === 0) return;

    setIsResolving(true);
    try {
      const logIds = Array.from(selectedLogIds);
      console.log("[v0] Resolving logs:", logIds);
      
      await api.resolveLogs(logIds);
      
      console.log("[v0] Logs resolved successfully");
      // Remove resolved logs from the list
      setLogs((prevLogs) => prevLogs.filter((log) => !selectedLogIds.has(log.id)));
      setSelectedLogIds(new Set());
      setTotalLogs((prev) => Math.max(0, prev - selectedLogIds.size));
    } catch (error) {
      console.error("[v0] Failed to resolve logs:", error);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <label className="text-xs text-muted-foreground block mb-2">Search</label>
            <Input
              placeholder="Search by message or trace ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="w-40">
            <label className="text-xs text-muted-foreground block mb-2">Service</label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {services.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All Services" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <label className="text-xs text-muted-foreground block mb-2">Level</label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {levels.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l === "all" ? "All Levels" : l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => setShowChart(!showChart)}
            >
              {showChart ? "Hide Chart" : "Show Chart"} ▾
            </Button>
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setSearch("");
                setService("all");
                setLevel("all");
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Collapsible Chart */}
      {showChart && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Log Volume over Time</h3>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="errors"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Logs Table */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {isLoadingLogs ? "Loading logs..." : `Showing ${logs.length} of ${totalLogs} logs`}
            {selectedLogIds.size > 0 && <span className="ml-4 font-semibold text-foreground">{selectedLogIds.size} selected</span>}
          </div>
          {selectedLogIds.size > 0 && (
            <Button
              onClick={handleResolveLogs}
              disabled={isResolving}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {isResolving ? "Resolving..." : `Resolve (${selectedLogIds.size})`}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    className="border-zinc-300 bg-zinc-100 text-zinc-900 data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900 data-[state=checked]:border-zinc-400"
                    checked={selectedLogIds.size === unresolvedLogs.length && unresolvedLogs.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={unresolvedLogs.length === 0}
                    aria-label="Select all logs"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground">Timestamp</TableHead>
                <TableHead className="text-muted-foreground">Level</TableHead>
                <TableHead className="text-muted-foreground">Service</TableHead>
                <TableHead className="text-muted-foreground">Trace ID</TableHead>
                <TableHead className="text-muted-foreground">Message</TableHead>
                <TableHead className="text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-border hover:bg-muted/50"
                  >
                    <TableCell>
                      {log.resolved ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Resolved log" />
                      ) : (
                        <Checkbox
                          className="border-zinc-300 bg-zinc-100 text-zinc-900 data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900 data-[state=checked]:border-zinc-400"
                          checked={selectedLogIds.has(log.id)}
                          onCheckedChange={() => handleToggleCheckbox(log.id)}
                          aria-label={`Select log ${log.id}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          log.level === "ERROR"
                            ? "bg-red-900 text-red-100"
                            : log.level === "WARN"
                              ? "bg-yellow-900 text-yellow-100"
                              : log.level === "INFO"
                                ? "bg-blue-900 text-blue-100"
                                : "bg-zinc-700 text-zinc-100"
                        }
                      >
                        {log.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.service}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {log.traceId ? `${log.traceId.slice(0, 12)}...` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-foreground max-w-xs truncate">
                      {log.message}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">
                      {isLoadingLogs ? "Searching logs..." : "No logs found"}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Log Detail Sheet */}
      <Sheet open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <SheetContent className="overflow-y-auto px-0 w-[95vw] sm:w-[88vw] md:w-[76vw] lg:w-[64vw] xl:w-[56vw] sm:max-w-none">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="text-foreground">Log Details</SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Inspect this log entry and run an AI debug session
            </SheetDescription>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-5 px-6 py-5">
              {/* Header */}
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Level</p>
                  <Badge
                    className={
                      selectedLog.level === "ERROR"
                        ? "bg-red-900 text-red-100"
                        : selectedLog.level === "WARN"
                          ? "bg-yellow-900 text-yellow-100"
                          : selectedLog.level === "INFO"
                            ? "bg-blue-900 text-blue-100"
                            : "bg-zinc-700 text-zinc-100"
                    }
                  >
                    {selectedLog.level}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Service</p>
                  <p className="text-sm text-foreground font-semibold">{selectedLog.service}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <p className="text-sm text-foreground">{selectedLog.timestamp.toLocaleString()}</p>
                </div>
              </div>

              {/* Trace ID */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Trace ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded border border-border bg-muted px-2 py-1 text-xs text-foreground font-mono break-all">
                    {selectedLog.traceId || "-"}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyTraceId}
                    disabled={!selectedLog.traceId}
                  >
                    {copiedTraceId ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Message */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <p className="text-sm text-foreground rounded border border-border bg-muted px-3 py-2">
                  {selectedLog.message}
                </p>
              </div>

              {/* Stack Trace */}
              {selectedLog.stackTrace && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-1">Stack Trace</p>
                  <code className="block rounded border border-border bg-muted px-3 py-2 text-xs text-foreground font-mono overflow-x-auto">
                    {selectedLog.stackTrace}
                  </code>
                </div>
              )}

              {/* Debug */}
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 pt-3">
                <p className="text-xs text-muted-foreground">
                  LogSpectra loads this trace, queries your service repo on GitHub when registered, and returns a root-cause
                  analysis with optional code fixes.
                </p>
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="remediation-pr" className="text-sm font-medium text-foreground">
                      Open GitHub remediation PR
                    </Label>
                    <p className="text-xs text-muted-foreground">Requires GitHub App and service git URL in registry</p>
                  </div>
                  <Switch
                    id="remediation-pr"
                    checked={createRemediationPr}
                    onCheckedChange={setCreateRemediationPr}
                    disabled={isAnalyzing}
                  />
                </div>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedLog.traceId}
                >
                  <Bug className="mr-2 h-4 w-4" />
                  {isAnalyzing ? "Debugging…" : "Debug"}
                </Button>
              </div>

              {showAnalysis && (
                <div className="border-t border-border pt-4">
                  <AIAnalysisPanel
                    result={analysisResult}
                    events={analysisEvents}
                    isStreaming={isAnalyzing}
                    error={analysisError}
                    traceId={selectedLog.traceId}
                    providerLabel={analyzeProvider}
                    createRemediationPr={createRemediationPr}
                    onClose={() => setShowAnalysis(false)}
                  />
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
