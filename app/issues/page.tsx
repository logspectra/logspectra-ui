"use client";

import { useEffect, useMemo, useState } from "react";
import { useProject } from "@/lib/project-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
} from "recharts";
import { api } from "@/lib/api";
import type { IssueGroup, IssueGroupBy } from "@/lib/types";
import { TrendingUp, TrendingDown, Brain } from "lucide-react";

export default function Issues() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueGroup[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<IssueGroupBy>("service_exception");
  const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!selectedProject?.id) {
      setIssues([]);
      return;
    }

    let cancelled = false;
    const fetchIssues = async () => {
      setIsLoadingIssues(true);
      try {
        const response = await api.getIssues(timeRange, customDateRange, {
          groupBy,
          service: serviceFilter !== "all" ? serviceFilter : undefined,
          page: 0,
          size: 100,
        });
        if (!cancelled) setIssues(response || []);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load issues", error);
          setIssues([]);
        }
      } finally {
        if (!cancelled) setIsLoadingIssues(false);
      }
    };

    fetchIssues();
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, timeRange, customDateRange, groupBy, serviceFilter]);

  const services = useMemo(() => {
    const values = new Set(issues.map((issue) => issue.service).filter(Boolean));
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [issues]);

  const filteredIssues = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return issues;

    return issues.filter((issue) => {
      const haystack = [
        issue.title,
        issue.service,
        issue.errorType,
        issue.traceId,
        issue.endpoint,
        issue.groupByKey,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [issues, search]);

  const stats = {
    open: filteredIssues.filter((i) => i.severity !== "LOW").length,
    critical: filteredIssues.filter((i) => i.severity === "CRITICAL").length,
    affectedServices: new Set(filteredIssues.map((i) => i.service).filter(Boolean)).size,
  };

  const getTrendData = (baseTrend: number[]) => {
    return Array.from({ length: 6 }, (_, i) => ({
      index: i,
      value: baseTrend[i] || 0,
    }));
  };

  const formatUtcToCurrentTimeZone = (value: Date | string | number) => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: currentTimeZone,
      timeZoneName: "short",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <label className="text-xs text-muted-foreground block mb-2">Search</label>
            <Input
              placeholder="Search by issue, service, endpoint, or trace ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="w-48">
            <label className="text-xs text-muted-foreground block mb-2">Group By</label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as IssueGroupBy)}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="service_exception">Service + Exception</SelectItem>
                <SelectItem value="traceId">Trace ID</SelectItem>
                <SelectItem value="endpoint">Endpoint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <label className="text-xs text-muted-foreground block mb-2">Service</label>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {services.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service === "all" ? "All Services" : service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Open Issues</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.open}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Critical Issues</p>
            <p className="text-3xl font-bold text-foreground mt-2 text-red-500">{stats.critical}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Affected Services</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.affectedServices}</p>
          </div>
        </Card>
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.map((issue) => (
          <Card
            key={issue.id}
            className="p-4 cursor-pointer hover:border-border/80 transition-colors"
            onClick={() =>
              setExpandedIssueId(
                expandedIssueId === issue.id ? null : issue.id
              )
            }
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge
                    className={
                      issue.severity === "CRITICAL"
                        ? "bg-red-900 text-red-100"
                        : issue.severity === "HIGH"
                          ? "bg-orange-900 text-orange-100"
                          : issue.severity === "MEDIUM"
                            ? "bg-yellow-900 text-yellow-100"
                            : "bg-blue-900 text-blue-100"
                    }
                  >
                    {issue.severity}
                  </Badge>
                  <h3 className="text-sm font-semibold text-foreground">
                    {groupBy === "endpoint"
                      ? issue.endpoint || issue.groupByKey || issue.title
                      : issue.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {issue.service} • {issue.errorType}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">
                  {issue.occurrences.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">occurrences</p>
              </div>
            </div>

            {/* Stats Row with Trend Chart */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">First Seen</p>
                  <p className="text-xs text-foreground">
                    {formatUtcToCurrentTimeZone(issue.firstSeen)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Seen</p>
                  <p className="text-xs text-foreground">
                    {formatUtcToCurrentTimeZone(issue.lastSeen)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trend (6h)</p>
                  <div className="flex items-center gap-1 mt-1">
                    {issue.severity === "CRITICAL" ? (
                      <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Trend Chart */}
              <AreaChart width={150} height={40} data={issue.trend.map((value, index) => ({ index, value }))}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={
                    issue.severity === "CRITICAL"
                      ? "#ef4444"
                      : issue.severity === "HIGH"
                        ? "#f97316"
                        : "#22c55e"
                  }
                  fill={
                    issue.severity === "CRITICAL"
                      ? "#ef4444"
                      : issue.severity === "HIGH"
                        ? "#f97316"
                        : "#22c55e"
                  }
                  fillOpacity={0.2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </div>

            {/* Expanded Content */}
            {expandedIssueId === issue.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                {/* Affected Services */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Affected Services</p>
                  <div className="flex flex-wrap gap-2">
                    {issue.affectedServices.map((service) => (
                      <Badge
                        key={service}
                        variant="secondary"
                        className="bg-muted text-foreground"
                      >
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Error Type Details */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Error Details</p>
                  <div className="rounded border border-border bg-muted px-3 py-2">
                    <code className="text-xs text-foreground font-mono">
                      {issue.errorType}
                    </code>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    title="soon"
                    disabled
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    View AI Analysis
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {filteredIssues.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground text-center">
            {isLoadingIssues ? "Loading issues..." : "No issues found for selected filters."}
          </Card>
        )}
      </div>
    </div>
  );
}
