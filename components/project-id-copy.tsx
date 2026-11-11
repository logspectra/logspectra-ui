"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProjectIdCopyProps = {
  projectId: string;
  className?: string;
  /** Card with label + copy — projects list */
  variant?: "inline" | "panel";
  onClickCapture?: (e: React.MouseEvent) => void;
};

export function ProjectIdCopy({
  projectId,
  className,
  variant = "inline",
  onClickCapture,
}: ProjectIdCopyProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onClickCapture?.(e);
    try {
      await navigator.clipboard.writeText(projectId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied
    }
  };

  if (variant === "panel") {
    return (
      <div
        className={cn("rounded-lg border border-border/70 bg-muted/30 p-3", className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Project ID</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug text-foreground">{projectId}</code>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="sr-only">Copy project ID</span>
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Paste into <span className="font-mono">logspectra.project-id</span> in your app.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)} onClick={(e) => e.stopPropagation()}>
      <code className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={projectId}>
        {projectId}
      </code>
      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={copy} title="Copy project ID">
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </Button>
    </div>
  );
}
