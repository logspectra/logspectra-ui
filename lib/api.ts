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

declare global {
  interface Window {
    __LOGSPECTRA_ENV?: {
      NEXT_PUBLIC_API_BASE_URL?: string;
    };
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8080";

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
  type: "progress" | "result" | "complete";
  message: string;
  timestamp?: string;
}

const timeRangeToHours = (timeRange: string | number): number => {
  if (typeof timeRange === "number") return timeRange;

  switch (timeRange) {
    case "1h":
      return 1;
    case "6h":
      return 6;
    case "24h":
      return 24;
    case "7d":
      return 24 * 7;
    case "30d":
      return 24 * 30;
    default:
      return 24;
  }
};

const getDateWindow = (timeRange: string | number, customDateRange?: CustomDateRange): { from: string; to: string } => {
  if (
    timeRange === "custom" &&
    customDateRange?.from instanceof Date &&
    customDateRange?.to instanceof Date
  ) {
    const from = new Date(customDateRange.from);
    const to = new Date(customDateRange.to);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const hours = timeRangeToHours(timeRange);
  return { from: isoHoursAgo(hours), to: nowIso() };
};

const durationHoursForCustomRange = (customDateRange?: CustomDateRange): number | null => {
  if (!(customDateRange?.from instanceof Date) || !(customDateRange?.to instanceof Date)) return null;

  const from = new Date(customDateRange.from);
  const to = new Date(customDateRange.to);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const diffMs = Math.max(0, to.getTime() - from.getTime());
  return Math.max(1, Math.ceil(diffMs / 3600_000));
};

const normalizeIssueWindow = (timeRange: string, customDateRange?: CustomDateRange): string => {
  if (timeRange === "custom") {
    const customHours = durationHoursForCustomRange(customDateRange);
    if (customHours === null) return "24h";
    if (customHours <= 1) return "1h";
    if (customHours <= 6) return "6h";
    if (customHours <= 24) return "24h";
    if (customHours <= 24 * 7) return "7d";
    return "30d";
  }

  if (timeRange === "1h" || timeRange === "6h" || timeRange === "24h" || timeRange === "7d" || timeRange === "30d") {
    return timeRange;
  }
  return "24h";
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

const isoHoursAgo = (hours: number): string => new Date(Date.now() - hours * 3600_000).toISOString();
const nowIso = (): string => new Date().toISOString();

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

const mapAnalysisResult = (r: AnalysisDto, fallbackTraceId?: string): AnalysisResult => ({
  severity: r.severity,
  confidence: r.confidence,
  service: r.service || r.affectedServices?.[0] || "unknown",
  errorSummary: r.errorSummary,
  rootCause: r.rootCause,
  affectedServices: r.affectedServices || [],
  suggestedFixes: (r.suggestedFixes || []).map((f) => ({
    priority: f.priority,
    effort: f.effort,
    description: f.description || f.fix || "No description",
    code: f.fix || f.description || "",
  })),
  relatedTraceIds: r.relatedTraceIds || (fallbackTraceId ? [fallbackTraceId] : []),
  analyzedAt: new Date(r.analyzedAt),
  cached: r.cached ?? r.cachedResult ?? false,
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

  return null;
};

async function streamAnalyzeLog(
  traceId: string,
  provider: "OPENAI" | "OLLAMA" | "CLAUDE",
  handlers: StreamAnalysisHandlers = {}
): Promise<AnalysisResult | null> {
  const headers = createApiHeaders();
  headers.set("Accept", "text/event-stream");

  const response = await fetch(`${getApiBaseUrl()}/api/v1/logs/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify({ traceId, provider }),
    signal: handlers.signal,
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
        handlers.onResult?.(finalResult);
        return;
      }

      const normalized = normalizeStreamEvent(eventName, payload);
      if (normalized?.type === "progress") {
        handlers.onProgress?.(normalized);
      } else if (normalized?.type === "complete") {
        handlers.onComplete?.(normalized);
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
interface AnalysisDto { severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; confidence: number; service?: string; errorSummary: string; rootCause: string; affectedServices: string[]; suggestedFixes: Array<{ fix?: string; description?: string; priority: "HIGH" | "MEDIUM" | "LOW"; effort: "QUICK" | "MEDIUM" | "COMPLEX" }>; relatedTraceIds: string[]; analyzedAt: string; cachedResult?: boolean; cached?: boolean }
interface ProviderModelsResponseDto { provider?: "OPENAI" | "OLLAMA" | "CLAUDE"; models?: string[] }

export interface ManagedUser { id: string; username: string; role: string; active: boolean; createdAt: string }
export interface AiSettings { id?: string; provider: "OPENAI" | "OLLAMA" | "CLAUDE"; apiKey?: string; modelName: string; baseUrl?: string; active?: boolean }
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

    const res = await apiRequest<PagedResponse<LogDto>>(`/api/v1/logs/search?${queryParams.toString()}`);

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
    const { from, to } = getDateWindow(timeRange, customDateRange);
    const res = await api.searchLogs({ from, to, size: 200, page: 0 });
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

  analyzeLog: async (traceId: string, provider: "OPENAI" | "OLLAMA" | "CLAUDE"): Promise<AnalysisResult> => {
    const r = await apiRequest<AnalysisDto>("/api/v1/logs/analyze", { method: "POST", body: JSON.stringify({ traceId, provider }) });
    return mapAnalysisResult(r, traceId);
  },

  streamAnalyzeLog: async (
    traceId: string,
    provider: "OPENAI" | "OLLAMA" | "CLAUDE",
    handlers: StreamAnalysisHandlers = {}
  ): Promise<AnalysisResult | null> => streamAnalyzeLog(traceId, provider, handlers),

  getDashboardData: async (timeRange = "24h", customDateRange?: CustomDateRange) => {
    const { from, to } = getDateWindow(timeRange, customDateRange);

    const [logs, issues, agg, statsDto] = await Promise.all([
      api.getLogs(timeRange, customDateRange),
      api.getIssues(timeRange, customDateRange),
      apiRequest<AggregationDto>(`/api/v1/logs/aggregations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      apiRequest<DashboardStatsDto>(`/api/v1/dashboard/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ]);

    const distribution: PieSlice[] = agg.services.map((s) => ({ name: s.service, value: s.totalErrors, color: svcColor(s.service) }));
    const topErrors: HorizontalBarPoint[] = agg.services.flatMap((s) => s.exceptions.map((e) => ({ name: e.exception || "Unknown", value: e.count }))).sort((a, b) => b.value - a.value).slice(0, 5);

    const serviceNames = Array.from(
      new Set([...(statsDto.totalServices || []), ...agg.services.map((s) => s.service)])
    );

    const makePoint = (timestamp: string): TimeSeriesPoint => {
      const point: TimeSeriesPoint = { timestamp };
      for (const service of serviceNames) {
        point[service] = 0;
      }
      return point;
    };

    const byHour: Record<string, TimeSeriesPoint> = {};
    const heatmapByServiceHour: Record<string, Record<number, number>> = {};
    for (const svc of agg.services) {
      for (const ex of svc.exceptions) {
        for (const t of ex.timeline) {
          const key = t.timestamp.slice(11, 16);
          const p = byHour[key] || makePoint(key);
          const current = typeof p[svc.service] === "number" ? (p[svc.service] as number) : 0;
          p[svc.service] = current + t.count;
          byHour[key] = p;

          const hour = Number.parseInt(t.timestamp.slice(11, 13), 10);
          if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
            if (!heatmapByServiceHour[svc.service]) {
              heatmapByServiceHour[svc.service] = {};
            }
            const currentHourCount = heatmapByServiceHour[svc.service][hour] ?? 0;
            heatmapByServiceHour[svc.service][hour] = currentHourCount + t.count;
          }
        }
      }
    }

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
    const heatmap: HeatmapCell[] = serviceNames.flatMap((service) =>
      Array.from({ length: 24 }, (_, hour) => ({
        service,
        hour,
        value: heatmapByServiceHour[service]?.[hour] ?? 0,
      }))
    );

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

    return {
      stats,
      logs,
      issues,
      analysisSeedTraceId: logs.find((l) => !!l.traceId)?.traceId,
      errorTimeline: Object.values(byHour).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
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
