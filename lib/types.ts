// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // Only for dummy auth
}

// Project Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  lastActivity: Date;
  serviceCount: number;
}

// Log Entry Types
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  service: string;
  traceId: string;
  message: string;
  endpoint?: string;
  stackTrace?: string;
  resolved?: boolean;
}

// Issue Types
export interface IssueGroup {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  service: string;
  errorType: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  trend: number[]; // Mini sparkline data
  affectedServices: string[];
  endpoint?: string;
  traceId?: string;
  groupByKey?: string;
}

export type IssueGroupBy = "service_exception" | "traceId" | "endpoint";

// Analysis Result
export interface AnalysisResult {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  service: string;
  errorSummary: string;
  rootCause: string;
  affectedServices: string[];
  suggestedFixes: {
    priority: "HIGH" | "MEDIUM" | "LOW";
    effort: "QUICK" | "MEDIUM" | "COMPLEX";
    description: string;
    code: string;
    filePath?: string;
    search?: string;
    replace?: string;
    newContent?: string;
  }[];
  relatedTraceIds: string[];
  fingerprint?: string;
  analyzedAt: Date;
  cached: boolean;
  remediationPrUrl?: string;
  remediationBranch?: string;
  remediationPrNumber?: number;
}

// Dashboard Stats
export interface DashboardStats {
  totalLogs: number;
  totalLogsChangePercent: number;
  errorCount: number;
  errorChangePercent: number;
  totalServices: string[];
  serviceCount: number;
  affectedServices: { count: number; services: string[] };
  aiAnalysesRun: number;
  aiCached: number;
  aiSaved: number;
}

// Chart Data Types
export interface TimeSeriesPoint {
  timestamp: string;
  [service: string]: string | number;
}

export interface PieSlice {
  name: string;
  value: number;
  color: string;
}

export interface BarPoint {
  name: string;
  value: number;
}

export interface HeatmapCell {
  service: string;
  hour: number;
  value: number;
}

export interface HorizontalBarPoint {
  name: string;
  value: number;
}

export interface ComposedPoint {
  date: string;
  errorRate: number;
  [service: string]: string | number;
}

export interface AreaPoint {
  hour: number;
  value: number;
}

export interface DualLinePoint {
  date: string;
  requested: number;
  cached: number;
}

export interface StackedAreaPoint {
  hour: string;
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
}

export interface SeverityMixPoint {
  period: string;
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface CorrelationCell {
  service1: string;
  service2: string;
  correlation: number;
}

export interface LivePoint {
  timestamp: number;
  errors: number;
  throughput: number;
}

// Severity Rule Types
export interface SeverityRule {
  id: string;
  ruleName: string;
  exceptionPattern: string;
  serviceName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  createdAt: Date;
  updatedAt: Date;
}

export type SeverityRuleInput = Omit<SeverityRule, "id" | "createdAt" | "updatedAt">;
