"use client";

import { useState, useEffect } from "react";
import { SeverityRule, SeverityRuleInput } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, FormProvider } from "react-hook-form";

interface SeverityRuleFormProps {
  rule?: SeverityRule;
  services: string[];
  onSave: (data: SeverityRuleInput) => void | Promise<void>;
  onClose: () => void;
}

export function SeverityRuleForm({
  rule,
  services,
  onSave,
  onClose,
}: SeverityRuleFormProps) {
  const [isOpen, setIsOpen] = useState(true);

  const form = useForm({
    defaultValues: rule
      ? {
          ruleName: rule.ruleName,
          exceptionPattern: rule.exceptionPattern,
          serviceName: rule.serviceName,
          severity: rule.severity,
        }
      : {
          ruleName: "",
          exceptionPattern: "",
          serviceName: "*",
          severity: "MEDIUM" as const,
        },
  });

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSave(data);
    handleClose();
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {rule ? "Edit Severity Rule" : "Create New Severity Rule"}
          </DialogTitle>
          <DialogDescription>
            Define a rule to automatically map error patterns to specific severity
            levels.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rule Name */}
            <FormField
            control={form.control}
            name="ruleName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rule Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Database Connection Timeout"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  A descriptive name for this severity mapping rule
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Exception Pattern */}
          <FormField
            control={form.control}
            name="exceptionPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exception Class</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., java.sql.SQLException"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  The exception class to match
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Service Name */}
          <FormField
            control={form.control}
            name="serviceName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Name</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="*">All Services</SelectItem>
                    {services.length > 0 ? (
                      services.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No services available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The microservice this rule applies to
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Severity Level */}
          <FormField
            control={form.control}
            name="severity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Severity Level</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  The severity level to assign when this pattern matches
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
            >
              {rule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
