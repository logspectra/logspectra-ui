/** Backend stores confidence on 0–1; legacy responses may use 0–100. */
export function formatAnalysisConfidencePercent(confidence: number): number {
  if (!Number.isFinite(confidence) || confidence < 0) {
    return 0;
  }
  const normalized = confidence > 1 && confidence <= 100 ? confidence / 100 : confidence;
  const clamped = Math.min(1, Math.max(0, normalized));
  return Math.round(clamped * 100);
}

export const ANALYSIS_CONFIDENCE_HINT =
  "Blends AI self-rating with log evidence (errors, stack traces, root-cause detail, actionable patches).";
