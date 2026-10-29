"use client";

import { useState, useEffect } from "react";
import { SeverityRule, SeverityRuleInput } from "@/lib/types";
import { api } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Plus, Shield } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-shell";
import { PanelCard } from "@/components/panel-card";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { SeverityRuleForm } from "@/components/severity-rule-form";
import { SeverityRulesTable } from "@/components/severity-rules-table";
import { PageErrorBanner } from "@/components/page-error-banner";

export default function SeverityRules() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const [rules, setRules] = useState<SeverityRule[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SeverityRule | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!selectedProject?.id) {
      setRules([]);
      setServices([]);
      return;
    }

    let cancelled = false;

    const fetchSeverityRuleData = async () => {
      setPageError("");
      try {
        const [dashboardData, severityRules] = await Promise.all([
          api.getDashboardData(timeRange, customDateRange),
          api.getSeverityRules(),
        ]);
        if (cancelled) return;
        setServices(dashboardData.stats?.totalServices ?? []);
        setRules(severityRules);
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Failed to load severity rules");
          setRules([]);
          setServices([]);
        }
      }
    };

    void fetchSeverityRuleData();
    return () => {
      cancelled = true;
    };
  }, [
    selectedProject?.id,
    timeRange,
    customDateRange.from?.getTime(),
    customDateRange.to?.getTime(),
  ]);

  const handleAddRule = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const handleEditRule = (rule: SeverityRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleSaveRule = async (formData: SeverityRuleInput) => {
    try {
      if (editingRule) {
        const updatedRule = await api.updateSeverityRule(editingRule.id, formData);
        setRules((prevRules) =>
          prevRules.map((rule) => (rule.id === editingRule.id ? updatedRule : rule))
        );
      } else {
        const createdRule = await api.createSeverityRule(formData);
        setRules((prevRules) => [createdRule, ...prevRules]);
      }
      setIsFormOpen(false);
      setEditingRule(null);
      setPageError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save severity rule";
      setPageError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await api.deleteSeverityRule(ruleId);
      setRules((prevRules) => prevRules.filter((rule) => rule.id !== ruleId));
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to delete severity rule");
    }
  };

  const stats = {
    total: rules.length,
    critical: rules.filter((r) => r.severity === "CRITICAL").length,
  };

  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Shield}
        eyebrow="Classification"
        title="Severity rules"
        description="Map exception patterns to severity levels for issue grouping and alerts."
        actions={
          <Button onClick={handleAddRule}>
            <Plus className="mr-2 h-4 w-4" />
            Add rule
          </Button>
        }
      />
      <PageErrorBanner message={pageError} />

      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Total rules" value={stats.total} />
        <StatCard
          label="Critical rules"
          value={stats.critical}
          hint={<span className="text-red-600 dark:text-red-400">Highest severity</span>}
        />
      </div>

      <PanelCard title="Exception pattern rules" bodyClassName="min-w-0">
        {rules.length > 0 ? (
          <SeverityRulesTable rules={rules} onEdit={handleEditRule} onDelete={handleDeleteRule} />
        ) : (
          <EmptyState
            icon={Shield}
            title="No severity rules yet"
            description="Rules match exception patterns (and optionally services) to CRITICAL, HIGH, MEDIUM, or LOW for issue grouping."
            action={
              <Button onClick={handleAddRule}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first rule
              </Button>
            }
          />
        )}
      </PanelCard>

      {/* Form Modal */}
      {isFormOpen && (
        <SeverityRuleForm
          rule={editingRule || undefined}
          services={services}
          onSave={handleSaveRule}
          onClose={() => {
            setIsFormOpen(false);
            setEditingRule(null);
          }}
        />
      )}
    </PageShell>
  );
}
