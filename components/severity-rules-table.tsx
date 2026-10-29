"use client";

import { SeverityRule } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SeverityRulesTableProps {
  rules: SeverityRule[];
  onEdit: (rule: SeverityRule) => void;
  onDelete: (ruleId: string) => void;
}

function severityBadgeClass(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200";
    case "LOW":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function SeverityRulesTable({
  rules,
  onEdit,
  onDelete,
}: SeverityRulesTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <>
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border/80">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="border-border/80 bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold">Rule name</TableHead>
              <TableHead className="font-semibold">Pattern</TableHead>
              <TableHead className="font-semibold">Service</TableHead>
              <TableHead className="font-semibold">Severity</TableHead>
              <TableHead className="w-[100px] text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className="border-border/60 hover:bg-muted/30">
                <TableCell className="max-w-[180px] font-medium text-foreground">
                  <span className="line-clamp-2">{rule.ruleName}</span>
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <code className="block break-all rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                    {rule.exceptionPattern}
                  </code>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {rule.serviceName === "*" ? "All services" : rule.serviceName}
                </TableCell>
                <TableCell>
                  <Badge className={cn("font-medium", severityBadgeClass(rule.severity))}>
                    {rule.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(rule)}
                      className="h-8 w-8 p-0"
                      aria-label={`Edit ${rule.ruleName}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirm(rule.id)}
                      aria-label={`Delete ${rule.ruleName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteConfirm && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete severity rule</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Issue severity for matching logs will fall back to defaults.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
