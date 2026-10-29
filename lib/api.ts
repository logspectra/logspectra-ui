import type {
  AnalysisResult,
  AreaPoint,
  BarPoint,
  ComposedPoint,
  DashboardStats,
  DualLinePoint,
  HeatmapCell,
  HorizontalBarPoint,
  SeverityMixPoint,
  IssueGroupBy,
  IssueGroup,
  LivePoint,
  LogEntry,
  PieSlice,
  Project,
  SeverityRule,
  SeverityRuleInput,
  StackedAreaPoint,
  TimeSeriesPoint,
  User,
} from "./types";
import { createEmptyDashboardData } from "@/lib/dashboard-data";
import { resolveDateWindow } from "@/lib/date-window";
import {
  bucketMsForWindow,
  buildErrorTimelineFromAggregations,
  buildErrorTimelineFromIngestion,
  buildErrorTimelineFromLogs,
  densifyErrorTimeline,
} from "@/lib/error-timeline";
import {
  buildHeatmapFromErrorLogs,
  buildTopErrorsFromLogs,
} from "@/lib/dashboard-charts";
import { normalizeIssueWindow } from "@/lib/time-range";

export { resolveDateWindow, isWithinDateWindow } from "@/lib/date-window";
export type { ResolvedDateWindow, CustomDateRangeInput } from "@/lib/date-window";
export type { TimeRange } from "@/lib/time-range";

declare global {
  interface Window {
    __LOGSPECTRA_ENV?: {
      NEXT_PUBLIC_API_BASE_URL?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8081";

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const runtimeUrl = window.__LOGSPECTRA_ENV?.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (runtimeUrl) return runtimeUrl.replace(/\/+$/, "");
  }

  const buildTimeUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (buildTimeUrl) return buildTimeUrl.replace(/\/+$/, "");

  return DEFAULT_API_BASE_URL;
};

const TOKEN_KEY = "authToken";

export interface CustomDateRange {
  from?: Date;
  to?: Date;
}

export interface AnalysisStreamEvent {
  type: "progress" | "result" | "complete" | "token" | "error";
  message: string;
  timestamp?: string;
}

export type AnalyzeProvider = "OPENAI" | "OLLAMA" | "CLAUDE" | "GEMINI";

export interface StreamAnalyzeOptions extends StreamAnalysisHandlers {
  provider?: AnalyzeProvider;
  createRemediationPr?: boolean;
}

const getDateWindow = (timeRange: string | number, customDateRange?: CustomDateRange): { from: string; to: string } => {
  const window = resolveDateWindow(timeRange, customDateRange);
  if (!window) {
    throw new Error("Custom time range requires both start and end dates");
  }
  return { from: window.from, to: window.to };
};

const handleUnauthorized = (): void => {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("currentUser");
  localStorage.removeItem("selectedProjectId");

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

const toUtcIsoString = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp provided for API request");
  }
  return date.toISOString();
};

type ApiOptions = RequestInit & { projectId?: string; userId?: string };

type StreamAnalysisHandlers = {
  onProgress?: (event: AnalysisStreamEvent) => void;
  onResult?: (result: AnalysisResult) => void;
  onComplete?: (event: AnalysisStreamEvent) => void;
  signal?: AbortSignal;
};

const createApiHeaders = (options: ApiOptions = {}): Headers => {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const selectedProjectId = typeof window !== "undefined" ? localStorage.getItem("selectedProjectId") : null;
  const currentUser = typeof window !== "undefined" ? localStorage.getItem("currentUser") : null;
  const parsedUser = currentUser ? (JSON.parse(currentUser) as User) : null;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.projectId || selectedProjectId) headers.set("X-Project-Id", options.projectId || selectedProjectId || "");
  if (options.userId || parsedUser?.id) headers.set("X-User-Id", options.userId || parsedUser?.id || "");

  return headers;
};

const parseAnalyzedAt = (value?: string): Date => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

/** When the backend streams raw JSON as tokens without a result event. */
export function parseAnalysisFromStreamText(text: string, fallbackTraceId?: string): AnalysisResult | null {
  const trimmed = text.trim();
  if (!trimmed.includes("errorSummary")) return null;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Partial<AnalysisDto>;
    if (!parsed.errorSummary && !parsed.rootCause) return null;
    return mapAnalysisResult(
      {
        severity: parsed.severity ?? "MEDIUM",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        service: parsed.service,
        errorSummary: parsed.errorSummary ?? "",
        rootCause: parsed.rootCause ?? "",
        affectedServices: parsed.affectedServices ?? [],
        suggestedFixes: parsed.suggestedFixes ?? [],
        relatedTraceIds: parsed.relatedTraceIds ?? [],
        fingerprint: parsed.fingerprint,
        analyzedAt: parsed.analyzedAt ?? new Date().toISOString(),
        cached: parsed.cached,
        cachedResult: parsed.cachedResult,
      },
      fallbackTraceId
    );
  } catch {
    return null;
  }
}

const mapAnalysisResult = (r: AnalysisDto, fallbackTraceId?: string): AnalysisResult => ({
  severity: r.severity ?? "MEDIUM",
  confidence: typeof r.confidence === "number" && !Number.isNaN(r.confidence) ? r.confidence : 0,
  service: r.service || r.affectedServices?.[0] || "unknown",
  errorSummary: r.errorSummary ?? "",
  rootCause: r.rootCause ?? "",
  affectedServices: r.affectedServices || [],
  suggestedFixes: (r.suggestedFixes || []).map((f) => {
    const patchPreview =
      f.search && f.replace != null
        ? `<<<<<<< SEARCH\n${f.search}\n=======\n${f.replace}\n>>>>>>> REPLACE`
        : f.newContent || f.fix || f.description || "";
    return {
      priority: f.priority ?? "MEDIUM",
      effort: f.effort ?? "MEDIUM",
      description: f.fix || f.description || "Suggested change",
      code: patchPreview,
      filePath: f.filePath,
      search: f.search,
      replace: f.replace,
      newContent: f.newContent,
    };
  }),
  relatedTraceIds: r.relatedTraceIds || (fallbackTraceId ? [fallbackTraceId] : []),
  fingerprint: r.fingerprint,
  analyzedAt: parseAnalyzedAt(r.analyzedAt),
  cached: r.cached ?? r.cachedResult ?? false,
  remediationPrUrl: r.remediationPrUrl,
  remediationBranch: r.remediationBranch,
  remediationPrNumber: r.remediationPrNumber,
});

const normalizeStreamEvent = (eventName: string, payload: Record<string, unknown>): AnalysisStreamEvent | null => {
  if (eventName === "progress") {
    return {
      type: "progress",
      message: typeof payload.message === "string" ? payload.message : "Working...",
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
    };
  }

  if (eventName === "complete") {
    return {
      type: "complete",
      message: typeof payload.message === "string" ? payload.message : "Analysis complete",
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
    };
  }

  if (eventName === "error") {
    return {
      type: "error",
      message: typeof payload.message === "string" ? payload.message : "Analysis failed",
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
    };
  }

  if (eventName === "token") {
    const text = typeof payload.text === "string" ? payload.text : "";
    return {
      type: "token",
      message: text,
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : undefined,
    };
  }

  return null;
};

async function streamAnalyzeLog(
  traceId: string,
  options: StreamAnalyzeOptions = {}
): Promise<AnalysisResult | null> {
  const provider = options.provider ?? "OPENAI";
  const headers = createApiHeaders();
  headers.set("Accept", "text/event-stream");

  const body: Record<string, unknown> = { traceId, provider };

  const response = await fetch(`${getApiBaseUrl()}/api/v1/logs/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignored
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Streaming response is not available");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AnalysisResult | null = null;
  let streamedTokens = "";

  const processBlock = (block: string) => {
    if (!block.trim()) return;

    let eventName = "message";
    const dataLines: string[] = [];

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return;

    try {
      const payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      if (eventName === "result") {
        const rawResult = (payload.result ?? payload) as AnalysisDto;
        finalResult = mapAnalysisResult(rawResult, traceId);
        options.onResult?.(finalResult);
        return;
      }

      const normalized = normalizeStreamEvent(eventName, payload);
      if (normalized?.type === "progress") {
        options.onProgress?.(normalized);
      } else if (normalized?.type === "complete") {
        options.onComplete?.(normalized);
      } else if (normalized?.type === "token") {
        streamedTokens += normalized.message;
        options.onProgress?.(normalized);
      } else if (normalized?.type === "error") {
        options.onProgress?.(normalized);
      }
    } catch {
      // ignore malformed SSE frames
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        processBlock(block);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResult && streamedTokens.trim()) {
    const parsed = parseAnalysisFromStreamText(streamedTokens, traceId);
    if (parsed) {
      finalResult = parsed;
      options.onResult?.(parsed);
    }
  }

  return finalResult;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = createApiHeaders(options);

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }

    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignored
    }
    throw new Error(message);
  }
  
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const tokenStore = {
  get: () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null),
  set: (token: string) => {
    if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
  },
  clear: () => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
}

interface LogDto { id: string; timestamp: string; level: "DEBUG" | "INFO" | "WARN" | "ERROR"; service: string; traceId: string; message: string; exception?: string, stackTrace?: string; resolved?: boolean; }
interface IssueDto { id: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; title?: string; service: string; errorType?: string; exceptionType?: string; occurrences?: number; occurrenceCount?: number; firstSeen: string; lastSeen: string; affectedServices?: string[]; trend?: number[]; endpoint?: string; traceId?: string; groupByKey?: string; }
interface AggregationDto { services: Array<{ service: string; totalErrors: number; exceptions: Array<{ exception: string; count: number; timeline: Array<{ timestamp: string; count: number }> }> }> }
interface DashboardStatsDto { totalLogs: number; totalLogsChangePercent: number; errorCount: number; errorChangePercent: number; affectedServices?: { count: number; services: string[] }; aiAnalysesRun: number; aiCached: number; aiSaved: number, totalServices: string[]; serviceCount: number }
interface WeeklyTrendPointDto { periodLabel: string; errorRate: number; serviceCounts: Record<string, number> }
interface WeeklyTrendResponseDto { services?: string[]; points?: WeeklyTrendPointDto[] }
interface AiUsagePointDto { periodLabel?: string; date?: string; requested?: number; cached?: number }
interface AiUsageResponseDto { points?: AiUsagePointDto[]; totalRequested?: number; totalCached?: number; cacheHitRate?: number }
interface IngestionRatePointDto {
  periodLabel?: string;
  hour?: string;
  levelCounts?: Partial<Record<"DEBUG" | "INFO" | "WARN" | "ERROR", number>>;
  DEBUG?: number;
  INFO?: number;
  WARN?: number;
  ERROR?: number;
}
interface IngestionRateResponseDto {
  points?: IngestionRatePointDto[];
}
interface SeverityMixPointDto {
  periodLabel?: string;
  period?: string;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  CRITICAL?: number;
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
}
interface SeverityMixResponseDto { points?: SeverityMixPointDto[] }
interface TopEndpointPointDto {
  name?: string;
  endpoint?: string;
  value?: number;
  count?: number;
}
interface TopEndpointsResponseDto { points?: TopEndpointPointDto[] }
interface ErrorResolutionPointDto {
  bucketHour?: number;
  hour?: number;
  issueCount?: number;
  value?: number;
}
interface ErrorResolutionResponseDto { points?: ErrorResolutionPointDto[] }
interface LiveLogDto {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  service: string;
  traceId: string;
  message: string;
  exception?: string;
  stackTrace?: string;
  resolved?: boolean;
}
interface LiveLogsResponseDto {
  logs?: LiveLogDto[];
}
interface LiveErrorPointDto {
  timestamp?: string | number;
  errors?: number;
  throughput?: number;
}
interface LiveErrorsResponseDto {
  points?: LiveErrorPointDto[];
}
interface SeverityRuleDto {
  id: string;
  ruleName: string;
  exceptionPattern: string;
  serviceName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  createdAt: string;
  updatedAt: string;
}
interface SeverityRuleUpsertDto {
  ruleName: string;
  exceptionPattern: string;
  serviceName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}
interface LoginResponseDto { token: string; user: { id: string; username: string; role: string; active: boolean; createdAt: string } }
interface ProjectDto { id: string; name: string; description?: string; createdAt: string; serviceCount?: number }
export interface RemediationResult {
  fingerprint: string;
  service?: string;
  patchesApplied: number;
  remediationPrUrl?: string;
  remediationBranch?: string;
  remediationPrNumber?: number;
  message?: string;
}

interface AnalysisDto {
  fingerprint?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  service?: string;
  errorSummary: string;
  rootCause: string;
  affectedServices: string[];
  suggestedFixes: Array<{
    fix?: string;
    description?: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    effort: "QUICK" | "MEDIUM" | "COMPLEX";
    filePath?: string;
    search?: string;
    replace?: string;
    newContent?: string;
  }>;
  relatedTraceIds: string[];
  analyzedAt: string;
  cachedResult?: boolean;
  cached?: boolean;
  remediationPrUrl?: string;
  remediationBranch?: string;
  remediationPrNumber?: number;
}
interface ProviderModelsResponseDto { provider?: AnalyzeProvider; models?: string[] }

export interface ManagedUser { id: string; username: string; role: string; active: boolean; createdAt: string }
export interface AiSettings {
  id?: string;
  provider: AnalyzeProvider;
  apiKey?: string;
  modelName: string;
  baseUrl?: string;
  active?: boolean;
}
export interface LogSearchParams {
  from: string;
  to: string;
  query?: string;
  level?: string;
  service?: string;
  traceId?: string;
  environment?: string;
  page?: number;
  size?: number;
  projectId?: string;
}

export interface IssueQueryParams {
  groupBy?: IssueGroupBy;
  service?: string;
  page?: number;
  size?: number;
}

export interface LiveStreamParams {
  service?: string;
  level?: string;
  projectId?: string;
}

const svcColor = (s: string) => ({ "api-gateway": "#3b82f6", "auth-service": "#ef4444", "payment-service": "#f97316", "admin-service": "#a855f7", "user-service": "#22c55e" }[s] || "#64748b");

const normalizeLogLevel = (level: string): LogEntry["level"] => {
  if (level === "DEBUG" || level === "INFO" || level === "WARN" || level === "ERROR") return level;
  return "INFO";
};

const mapWeeklyTrend = (dto: WeeklyTrendResponseDto | null | undefined, fallbackServices: string[]): ComposedPoint[] => {
  const points = dto?.points || [];
  const responseServices = dto?.services || [];
  const detectedServices = points.flatMap((p) => Object.keys(p.serviceCounts || {}));
  const services = Array.from(new Set([...responseServices, ...fallbackServices, ...detectedServices]));

  return points.map((point) => {
    const row: ComposedPoint = {
      date: point.periodLabel,
      errorRate: point.errorRate ?? 0,
    };
    for (const service of services) {
      row[service] = point.serviceCounts?.[service] ?? 0;
    }
    return row;
  });
};

const mapAiUsage = (dto: AiUsageResponseDto | null | undefined): DualLinePoint[] => {
  const points = dto?.points || [];
  return points.map((point, index) => ({
    date: point.periodLabel || point.date || `Bucket ${index + 1}`,
    requested: point.requested ?? 0,
    cached: point.cached ?? 0,
  }));
};

const mapIngestionRate = (dto: IngestionRateResponseDto | null | undefined): StackedAreaPoint[] => {
  const points = dto?.points || [];
  return points.map((point, index) => {
    const levels = point.levelCounts || {};
    return {
      hour: point.periodLabel || point.hour || `Bucket ${index + 1}`,
      DEBUG: point.DEBUG ?? levels.DEBUG ?? 0,
      INFO: point.INFO ?? levels.INFO ?? 0,
      WARN: point.WARN ?? levels.WARN ?? 0,
      ERROR: point.ERROR ?? levels.ERROR ?? 0,
    };
  });
};

const mapSeverityMix = (dto: SeverityMixResponseDto | null | undefined): SeverityMixPoint[] => {
  const points = dto?.points || [];
  return points.map((point, index) => ({
    period: point.periodLabel || point.period || `Bucket ${index + 1}`,
    CRITICAL: point.CRITICAL ?? point.critical ?? 0,
    HIGH: point.HIGH ?? point.high ?? 0,
    MEDIUM: point.MEDIUM ?? point.medium ?? 0,
    LOW: point.LOW ?? point.low ?? 0,
  }));
};

const mapTopEndpoints = (dto: TopEndpointsResponseDto | null | undefined): HorizontalBarPoint[] => {
  const points = dto?.points || [];
  return points
    .map((point) => ({
      name: point.name || point.endpoint || "Unknown endpoint",
      value: point.value ?? point.count ?? 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
};

const mapResolutionDist = (dto: ErrorResolutionResponseDto | null | undefined): AreaPoint[] => {
  const points = dto?.points || [];
  return points.map((point, index) => ({
    hour: point.bucketHour ?? point.hour ?? index,
    value: point.issueCount ?? point.value ?? 0,
  }));
};

const mapSeverityRule = (dto: SeverityRuleDto): SeverityRule => ({
  id: dto.id,
  ruleName: dto.ruleName,
  exceptionPattern: dto.exceptionPattern,
  serviceName: dto.serviceName,
  severity: dto.severity,
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

export const api = {
  login: async (username: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await apiRequest<LoginResponseDto>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    return { token: res.token, user: { id: res.user.id, email: res.user.username, name: res.user.username } };
  },

  getProjects: async (): Promise<Project[]> => {
    const data = await apiRequest<ProjectDto[]>("/api/v1/projects");
    return data.map((p) => ({ id: p.id, name: p.name, description: p.description, ownerId: "", createdAt: new Date(p.createdAt), lastActivity: new Date(p.createdAt), serviceCount: p.serviceCount ?? 0 }));
  },

  createProject: async (name: string, description?: string): Promise<Project> => {
    const p = await apiRequest<ProjectDto>("/api/v1/projects", { method: "POST", body: JSON.stringify({ name, description }) });
    return { id: p.id, name: p.name, description: p.description, ownerId: "", createdAt: new Date(p.createdAt), lastActivity: new Date(p.createdAt), serviceCount: p.serviceCount ?? 0 };
  },

  searchLogs: async (params: LogSearchParams): Promise<PagedResponse<LogEntry>> => {
    const fromUtc = toUtcIsoString(params.from);
    const toUtc = toUtcIsoString(params.to);

    const queryParams = new URLSearchParams({
      from: fromUtc,
      to: toUtc,
      page: String(params.page ?? 0),
      size: String(params.size ?? 20),
    });

    if (params.query) queryParams.set("query", params.query);
    if (params.level) queryParams.set("level", params.level);
    if (params.service) queryParams.set("service", params.service);
    if (params.traceId) queryParams.set("traceId", params.traceId);
    if (params.environment) queryParams.set("environment", params.environment);

    const res = await apiRequest<PagedResponse<LogDto>>(`/api/v1/logs/search?${queryParams.toString()}`, {
      projectId: params.projectId,
    });

    return {
      ...res,
      content: (res.content || []).map((l) => ({
        id: l.id,
        timestamp: new Date(l.timestamp),
        level: normalizeLogLevel(l.level),
        service: l.service,
        traceId: l.traceId,
        message: l.message,
        stackTrace: l.stackTrace || l.exception || "",
        resolved: l.resolved ?? false,
      })),
    };
  },

  getLogs: async (timeRange: string | number = "24h", customDateRange?: CustomDateRange): Promise<LogEntry[]> => {
    const window = resolveDateWindow(timeRange, customDateRange);
    if (!window) return [];
    const res = await api.searchLogs({ from: window.from, to: window.to, size: 200, page: 0 });
    return res.content || [];
  },

  getLiveLogs: async (size = 200): Promise<LogEntry[]> => {
    const queryParams = new URLSearchParams({
      size: String(size),
    });
    const res = await apiRequest<LiveLogsResponseDto>(`/api/v1/logs/live?${queryParams.toString()}`);
    const logs = res.logs || [];

    return logs.map((l) => ({
      id: l.id,
      timestamp: new Date(l.timestamp),
      level: normalizeLogLevel(l.level),
      service: l.service,
      traceId: l.traceId,
      message: l.message,
      stackTrace: l.stackTrace || l.exception || "",
      resolved: l.resolved ?? false,
    }));
  },

  getLiveLogsStreamUrl: (params: LiveStreamParams = {}): string => {
    const queryParams = new URLSearchParams();
    if (params.service) queryParams.set("service", params.service);
    if (params.level) queryParams.set("level", params.level);
    if (params.projectId) queryParams.set("projectId", params.projectId);

    const queryString = queryParams.toString();
    // Same-origin SSE proxy avoids cross-origin streaming issues in the browser.
    if (typeof window !== "undefined") {
      return `/api/logs/stream${queryString ? `?${queryString}` : ""}`;
    }
    return `${getApiBaseUrl()}/api/v1/logs/stream${queryString ? `?${queryString}` : ""}`;
  },

  getLiveErrors: async (points = 60): Promise<LivePoint[]> => {
    const queryParams = new URLSearchParams({
      points: String(points),
    });
    const res = await apiRequest<LiveErrorsResponseDto>(`/api/v1/live/errors?${queryParams.toString()}`);
    const values = res.points || [];

    return values.map((point, index) => ({
      timestamp: typeof point.timestamp === "number" ? point.timestamp : index,
      errors: point.errors ?? 0,
      throughput: point.throughput ?? 0,
    }));
  },

  getIssues: async (
    timeRange = "24h",
    customDateRange?: CustomDateRange,
    queryParams?: IssueQueryParams
  ): Promise<IssueGroup[]> => {
    const window = normalizeIssueWindow(timeRange, customDateRange);
    if (!window) return [];
    const params = new URLSearchParams({
      window,
      size: String(queryParams?.size ?? 100),
      page: String(queryParams?.page ?? 0),
    });

    if (queryParams?.groupBy) params.set("groupBy", queryParams.groupBy);
    if (queryParams?.service) params.set("service", queryParams.service);

    const res = await apiRequest<IssueDto[]>(`/api/v1/logs/issues?${params.toString()}`);
    return res.map((i) => ({
      id: i.id,
      severity: i.severity,
      title: i.title || i.errorType || i.exceptionType || "Unknown issue",
      service: i.service,
      errorType: i.errorType || i.exceptionType || "Unknown",
      occurrences: i.occurrences || i.occurrenceCount || 0,
      firstSeen: new Date(i.firstSeen),
      lastSeen: new Date(i.lastSeen),
      trend: i.trend || [1, 2, 3, 4, 3, 2],
      affectedServices: i.affectedServices || [i.service],
      endpoint: i.endpoint,
      traceId: i.traceId,
      groupByKey: i.groupByKey || i.endpoint || i.traceId,
    }));
  },

  getSeverityRules: async (): Promise<SeverityRule[]> => {
    const response = await apiRequest<SeverityRuleDto[]>("/api/v1/severity-rules");
    return (response || []).map(mapSeverityRule);
  },

  createSeverityRule: async (payload: SeverityRuleInput): Promise<SeverityRule> => {
    const dto: SeverityRuleUpsertDto = {
      ruleName: payload.ruleName,
      exceptionPattern: payload.exceptionPattern,
      serviceName: payload.serviceName,
      severity: payload.severity,
    };
    const response = await apiRequest<SeverityRuleDto>("/api/v1/severity-rules", {
      method: "POST",
      body: JSON.stringify(dto),
    });
    return mapSeverityRule(response);
  },

  updateSeverityRule: async (id: string, payload: SeverityRuleInput): Promise<SeverityRule> => {
    const dto: SeverityRuleUpsertDto = {
      ruleName: payload.ruleName,
      exceptionPattern: payload.exceptionPattern,
      serviceName: payload.serviceName,
      severity: payload.severity,
    };
    const response = await apiRequest<SeverityRuleDto>(`/api/v1/severity-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    });
    return mapSeverityRule(response);
  },

  deleteSeverityRule: async (id: string): Promise<void> => {
    await apiRequest<void>(`/api/v1/severity-rules/${id}`, { method: "DELETE" });
  },

  analyzeLog: async (traceId: string, provider: AnalyzeProvider): Promise<AnalysisResult> => {
    const r = await apiRequest<AnalysisDto>("/api/v1/logs/analyze", { method: "POST", body: JSON.stringify({ traceId, provider }) });
    return mapAnalysisResult(r, traceId);
  },

  streamAnalyzeLog: async (traceId: string, options: StreamAnalyzeOptions = {}): Promise<AnalysisResult | null> =>
    streamAnalyzeLog(traceId, options),

  applyRemediation: async (fingerprint: string, traceId?: string): Promise<RemediationResult> =>
    apiRequest<RemediationResult>("/api/v1/logs/remediate", {
      method: "POST",
      body: JSON.stringify({ fingerprint, traceId }),
    }),

  getDashboardData: async (timeRange = "24h", customDateRange?: CustomDateRange) => {
    const window = resolveDateWindow(timeRange, customDateRange);
    if (!window) {
      return createEmptyDashboardData();
    }
    const { from, to } = window;

    const [logs, issues, agg, statsDto, errorLogsPage] = await Promise.all([
      api.getLogs(timeRange, customDateRange),
      api.getIssues(timeRange, customDateRange),
      apiRequest<AggregationDto>(`/api/v1/logs/aggregations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      apiRequest<DashboardStatsDto>(`/api/v1/dashboard/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      api.searchLogs({ from, to, level: "ERROR", size: 2000, page: 0 }).catch(() => ({ content: [] as LogEntry[], totalElements: 0 })),
    ]);

    const aggServices = agg?.services ?? [];
    const distribution: PieSlice[] = aggServices.map((s) => ({ name: s.service, value: s.totalErrors, color: svcColor(s.service) }));

    const errorLogsForCharts =
      errorLogsPage.content && errorLogsPage.content.length > 0
        ? errorLogsPage.content
        : logs.filter((l) => l.level === "ERROR");

    let topErrors: HorizontalBarPoint[] = aggServices
      .flatMap((s) => (s.exceptions ?? []).map((e) => ({ name: e.exception || "Unknown", value: e.count })))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    if (topErrors.length === 0) {
      topErrors = buildTopErrorsFromLogs(errorLogsForCharts, 5);
    }

    const serviceNames = Array.from(
      new Set([
        ...(statsDto.totalServices || []),
        ...aggServices.map((s) => s.service),
        ...errorLogsForCharts.map((l) => l.service),
      ])
    ).filter(Boolean);

    const heatmapBuilt = buildHeatmapFromErrorLogs(
      errorLogsForCharts,
      serviceNames,
      window.fromMs,
      window.toMs
    );
    const heatmap = heatmapBuilt.cells;
    const heatmapMeta = {
      bucketMs: heatmapBuilt.bucketMs,
      bucketCount: heatmapBuilt.bucketCount,
      windowFromMs: heatmapBuilt.windowFromMs,
    };

    const affectedServices = statsDto.affectedServices || { count: 0, services: [] };

    const stats: DashboardStats = {
      totalLogs: statsDto.totalLogs ?? 0,
      totalLogsChangePercent: statsDto.totalLogsChangePercent ?? 0,
      errorCount: statsDto.errorCount ?? 0,
      errorChangePercent: statsDto.errorChangePercent ?? 0,
      affectedServices,
      aiAnalysesRun: statsDto.aiAnalysesRun ?? 0,
      aiCached: statsDto.aiCached ?? 0,
      aiSaved: statsDto.aiSaved ?? 0,
      totalServices: statsDto.totalServices ?? serviceNames,
      serviceCount: statsDto.serviceCount ?? serviceNames.length,
    };

    const levelVolume: BarPoint[] = ["DEBUG", "INFO", "WARN", "ERROR"].map((level) => ({ name: level, value: logs.filter((l) => l.level === level).length }));

    const weeklyTrendResponse = await apiRequest<WeeklyTrendResponseDto>(
      `/api/v1/analytics/weekly-trend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const weeklyTrend = mapWeeklyTrend(weeklyTrendResponse, serviceNames);

    const aiUsageResponse = await apiRequest<AiUsageResponseDto>(
      `/api/v1/analytics/ai-usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const aiUsage = mapAiUsage(aiUsageResponse);

    const ingestionRateResponse = await apiRequest<IngestionRateResponseDto>(
      `/api/v1/analytics/ingestion-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const ingestionRate = mapIngestionRate(ingestionRateResponse);

    const severityMixResponse = await apiRequest<SeverityMixResponseDto>(
      `/api/v1/analytics/severity-mix?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const severityMix = mapSeverityMix(severityMixResponse);

    const topEndpointsResponse = await apiRequest<TopEndpointsResponseDto>(
      `/api/v1/analytics/top-endpoints?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const topEndpoints = mapTopEndpoints(topEndpointsResponse);

    const resolutionResponse = await apiRequest<ErrorResolutionResponseDto>(
      `/api/v1/analytics/error-resolution?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ).catch(() => null);
    const resolutionDist = mapResolutionDist(resolutionResponse);

    let errorTimeline = buildErrorTimelineFromAggregations(aggServices, serviceNames);
    if (errorTimeline.length === 0) {
      const errorLogs = errorLogsPage.content?.length ? errorLogsPage.content : logs;
      errorTimeline = buildErrorTimelineFromLogs(errorLogs, serviceNames, window.fromMs, window.toMs);
    }
    if (errorTimeline.length === 0) {
      errorTimeline = buildErrorTimelineFromIngestion(ingestionRate);
    }

    const bucketMs = bucketMsForWindow(window.fromMs, window.toMs);
    if (errorTimeline.length > 0) {
      errorTimeline = densifyErrorTimeline(
        errorTimeline,
        serviceNames,
        window.fromMs,
        window.toMs,
        bucketMs
      );
    }

    return {
      stats,
      logs,
      issues,
      analysisSeedTraceId: logs.find((l) => !!l.traceId)?.traceId,
      errorTimeline,
      distribution,
      levelVolume,
      topErrors,
      weeklyTrend,
      resolutionDist,
      aiUsage,
      ingestionRate,
      severityMix,
      topEndpoints,
      heatmap,
      heatmapMeta,
      liveErrors: Array.from({ length: 60 }, (_, i) => ({ timestamp: i, errors: 0, throughput: 0 })) as LivePoint[],
    };
  },

  listUsers: async (): Promise<ManagedUser[]> => apiRequest<ManagedUser[]>("/api/v1/users"),
  createUser: async (username: string, password: string, role: "ADMIN" | "USER"): Promise<ManagedUser> =>
    apiRequest<ManagedUser>("/api/v1/users", { method: "POST", body: JSON.stringify({ username, password, role }) }),
  deleteUser: async (id: string): Promise<void> => apiRequest<void>(`/api/v1/users/${id}`, { method: "DELETE" }),
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> =>
    apiRequest<void>("/api/v1/users/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getAiSettings: async (): Promise<AiSettings> => apiRequest<AiSettings>("/api/v1/ai/settings"),
  getProviderModels: async (provider: AiSettings["provider"]): Promise<string[]> => {
    const queryParams = new URLSearchParams({ provider });
    const response = await apiRequest<ProviderModelsResponseDto>(`/api/v1/ai/settings/providers/models?${queryParams.toString()}`);
    return response?.models || [];
  },
  upsertAiSettings: async (payload: AiSettings): Promise<AiSettings> => apiRequest<AiSettings>("/api/v1/ai/settings", { method: "POST", body: JSON.stringify(payload) }),

  resolveLogs: async (logIds: string[]): Promise<void> => {
    await apiRequest<void>("/api/v1/logs/resolve", { 
      method: "POST", 
      body: JSON.stringify({ logIds }) 
    });
  },
};
