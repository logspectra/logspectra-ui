"use client";

import { useState, useEffect } from "react";
import { SeverityRule, SeverityRuleInput } from "@/lib/types";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SeverityRuleForm } from "@/components/severity-rule-form";
import { SeverityRulesTable } from "@/components/severity-rules-table";
import { PageErrorBanner } from "@/components/page-error-banner";

export default function SeverityRules() {
  const [rules, setRules] = useState<SeverityRule[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SeverityRule | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    const fetchSeverityRuleData = async () => {
      setPageError("");
      try {
        const [dashboardData, severityRules] = await Promise.all([
          api.getDashboardData(),
          api.getSeverityRules(),
        ]);
        if (dashboardData.stats?.totalServices) {
          setServices(dashboardData.stats.totalServices);
        }
        setRules(severityRules);
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Failed to load severity rules");
      }
    };
    fetchSeverityRuleData();
  }, []);

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
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save severity rule");
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
    <div className="space-y-6">
      <PageErrorBanner message={pageError} />
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Rules</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.total}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div>
            <p className="text-sm text-muted-foreground">Critical Severity</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.critical}</p>
          </div>
        </Card>
      </div>

      {/* Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Exception Pattern Rules
          </h2>
          <Button
            onClick={handleAddRule}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Rule
          </Button>
        </div>

        {rules.length > 0 ? (
          <SeverityRulesTable
            rules={rules}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
          />
        ) : (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No severity rules configured yet. Create your first rule to get started.
            </p>
          </Card>
        )}
      </div>

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
    </div>
  );
}
