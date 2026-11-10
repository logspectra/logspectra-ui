/** Tinted badge classes readable on both light and dark surfaces. */

const RED = "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";
const ORANGE = "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300";
const AMBER = "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
const BLUE = "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300";
const NEUTRAL = "border-border bg-muted text-muted-foreground";

const LOG_LEVEL: Record<string, string> = { ERROR: RED, WARN: AMBER, INFO: BLUE };
const SEVERITY: Record<string, string> = { CRITICAL: RED, HIGH: ORANGE, MEDIUM: AMBER, LOW: BLUE };

export const logLevelClass = (level?: string) => LOG_LEVEL[level?.toUpperCase() ?? ""] ?? NEUTRAL;

export const severityClass = (severity?: string) => SEVERITY[severity?.toUpperCase() ?? ""] ?? NEUTRAL;
