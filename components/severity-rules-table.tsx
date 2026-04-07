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

interface SeverityRulesTableProps {
  rules: SeverityRule[];
  onEdit: (rule: SeverityRule) => void;
  onDelete: (ruleId: string) => void;
}

export function SeverityRulesTable({
  rules,
  onEdit,
  onDelete,
}: SeverityRulesTableProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-900 text-red-100";
      case "HIGH":
        return "bg-orange-900 text-orange-100";
      case "MEDIUM":
        return "bg-yellow-900 text-yellow-100";
      case "LOW":
        return "bg-blue-900 text-blue-100";
      default:
        return "bg-gray-900 text-gray-100";
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Rule Name</TableHead>
              <TableHead className="font-semibold">Pattern</TableHead>
              <TableHead className="font-semibold">Service</TableHead>
              <TableHead className="font-semibold">Severity</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium text-foreground">
                  {rule.ruleName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {rule.exceptionPattern}
                  </code>
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {rule.serviceName}
                </TableCell>
                <TableCell>
                  <Badge className={getSeverityColor(rule.severity)}>
                    {rule.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(rule)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:text-red-500"
                      onClick={() => setDeleteConfirm(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Severity Rule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this rule? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="bg-red-600 hover:bg-red-700"
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
